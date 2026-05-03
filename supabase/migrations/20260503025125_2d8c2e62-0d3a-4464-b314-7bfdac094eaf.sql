
-- Index for fast rolling-window lookups
CREATE INDEX IF NOT EXISTS idx_request_logs_user_created
  ON public.request_logs (user_id, created_at DESC);

-- Enforce rolling quota and (if allowed) record an attempt by inserting into request_logs is done by chat function.
-- This function only checks; it raises with a structured message if blocked.
CREATE OR REPLACE FUNCTION public.check_rolling_quota()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  is_admin boolean;
  is_pro boolean;
  count_5h int;
  count_24h int;
  oldest_in_window timestamptz;
  retry_seconds int;
  window_limit int := 10;
  daily_limit int := 30;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'QUOTA_UNAUTHENTICATED';
  END IF;

  is_admin := public.has_role(uid, 'admin');
  SELECT ut.is_pro INTO is_pro FROM public.usage_tracking ut WHERE ut.user_id = uid;
  is_pro := COALESCE(is_pro, false);

  IF is_admin OR is_pro THEN
    RETURN jsonb_build_object('allowed', true, 'unlimited', true);
  END IF;

  SELECT COUNT(*), MIN(created_at)
    INTO count_5h, oldest_in_window
  FROM public.request_logs
  WHERE user_id = uid AND created_at > now() - interval '5 hours';

  SELECT COUNT(*) INTO count_24h
  FROM public.request_logs
  WHERE user_id = uid AND created_at > now() - interval '24 hours';

  IF count_5h >= window_limit THEN
    retry_seconds := GREATEST(0, EXTRACT(EPOCH FROM (oldest_in_window + interval '5 hours' - now()))::int);
    RAISE EXCEPTION 'QUOTA_EXCEEDED:5h:%', retry_seconds;
  END IF;

  IF count_24h >= daily_limit THEN
    SELECT MIN(created_at) INTO oldest_in_window
    FROM public.request_logs
    WHERE user_id = uid AND created_at > now() - interval '24 hours';
    retry_seconds := GREATEST(0, EXTRACT(EPOCH FROM (oldest_in_window + interval '24 hours' - now()))::int);
    RAISE EXCEPTION 'QUOTA_EXCEEDED:24h:%', retry_seconds;
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'used_5h', count_5h,
    'limit_5h', window_limit,
    'used_24h', count_24h,
    'limit_24h', daily_limit
  );
END;
$$;

-- Read-only view of rolling usage for the UI
CREATE OR REPLACE FUNCTION public.get_rolling_usage()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  is_admin boolean;
  is_pro boolean;
  count_5h int;
  count_24h int;
  oldest_5h timestamptz;
  reset_at timestamptz;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('authenticated', false);
  END IF;

  is_admin := public.has_role(uid, 'admin');
  SELECT ut.is_pro INTO is_pro FROM public.usage_tracking ut WHERE ut.user_id = uid;
  is_pro := COALESCE(is_pro, false);

  SELECT COUNT(*), MIN(created_at)
    INTO count_5h, oldest_5h
  FROM public.request_logs
  WHERE user_id = uid AND created_at > now() - interval '5 hours';

  SELECT COUNT(*) INTO count_24h
  FROM public.request_logs
  WHERE user_id = uid AND created_at > now() - interval '24 hours';

  reset_at := CASE WHEN oldest_5h IS NOT NULL THEN oldest_5h + interval '5 hours' ELSE NULL END;

  RETURN jsonb_build_object(
    'is_pro', is_pro,
    'is_admin', is_admin,
    'used_5h', count_5h,
    'limit_5h', 10,
    'used_24h', count_24h,
    'limit_24h', 30,
    'reset_at', reset_at
  );
END;
$$;
