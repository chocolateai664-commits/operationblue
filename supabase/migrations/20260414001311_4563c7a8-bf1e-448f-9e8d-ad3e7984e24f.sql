
-- 1. Create app_role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('user', 'pro', 'admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own role"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. Security definer function for role checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 3. Add cost tracking columns to usage_tracking
ALTER TABLE public.usage_tracking
  ADD COLUMN monthly_cost NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN monthly_tokens INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN cost_reset_at TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now());

-- 4. Create request_logs table
CREATE TABLE public.request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own request logs"
  ON public.request_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 5. Security definer function to log requests
CREATE OR REPLACE FUNCTION public.log_request(
  _model TEXT,
  _input_tokens INTEGER,
  _output_tokens INTEGER,
  _cost NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.request_logs (user_id, model, input_tokens, output_tokens, cost)
  VALUES (auth.uid(), _model, _input_tokens, _output_tokens, _cost);
END;
$$;

-- 6. Update increment_usage to enforce cost limits
CREATE OR REPLACE FUNCTION public.increment_usage(
  _input_tokens INTEGER DEFAULT 0,
  _cost NUMERIC DEFAULT 0
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
  current_cost NUMERIC;
  current_is_pro BOOLEAN;
  is_admin BOOLEAN;
  cost_limit NUMERIC;
  reset_at TIMESTAMPTZ;
BEGIN
  -- Check if admin
  is_admin := public.has_role(auth.uid(), 'admin');

  -- Get or create usage row
  SELECT total_requests, monthly_cost, is_pro, cost_reset_at
  INTO new_count, current_cost, current_is_pro, reset_at
  FROM usage_tracking
  WHERE user_id = auth.uid();

  IF new_count IS NULL THEN
    INSERT INTO usage_tracking (user_id, total_requests, is_pro, monthly_cost, monthly_tokens, cost_reset_at)
    VALUES (auth.uid(), 0, false, 0, 0, date_trunc('month', now()))
    RETURNING total_requests, monthly_cost, is_pro, cost_reset_at
    INTO new_count, current_cost, current_is_pro, reset_at;
  END IF;

  -- Auto-reset monthly counters if new month
  IF reset_at < date_trunc('month', now()) THEN
    UPDATE usage_tracking
    SET monthly_cost = 0, monthly_tokens = 0, cost_reset_at = date_trunc('month', now())
    WHERE user_id = auth.uid();
    current_cost := 0;
  END IF;

  -- Determine cost limit
  IF is_admin THEN
    cost_limit := 999999; -- effectively unlimited
  ELSIF current_is_pro THEN
    cost_limit := 7.00;
  ELSE
    cost_limit := 0.50;
  END IF;

  -- Enforce limit
  IF current_cost + _cost > cost_limit THEN
    RAISE EXCEPTION 'Monthly cost limit exceeded (%.2f / %.2f)', current_cost + _cost, cost_limit;
  END IF;

  -- Update
  UPDATE usage_tracking
  SET total_requests = total_requests + 1,
      monthly_cost = monthly_cost + _cost,
      monthly_tokens = monthly_tokens + _input_tokens,
      updated_at = now()
  WHERE user_id = auth.uid()
  RETURNING total_requests INTO new_count;

  RETURN new_count;
END;
$$;
