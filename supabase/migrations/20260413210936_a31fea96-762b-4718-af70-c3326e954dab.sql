-- Remove client UPDATE policy to prevent counter manipulation
DROP POLICY "Users can update own usage" ON usage_tracking;

-- Create a SECURITY DEFINER function to safely increment usage
CREATE OR REPLACE FUNCTION public.increment_usage()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count integer;
BEGIN
  UPDATE usage_tracking
  SET total_requests = total_requests + 1,
      updated_at = now()
  WHERE user_id = auth.uid()
  RETURNING total_requests INTO new_count;

  -- If no row existed, create one
  IF new_count IS NULL THEN
    INSERT INTO usage_tracking (user_id, total_requests, is_pro)
    VALUES (auth.uid(), 1, false)
    RETURNING total_requests INTO new_count;
  END IF;

  RETURN new_count;
END;
$$;