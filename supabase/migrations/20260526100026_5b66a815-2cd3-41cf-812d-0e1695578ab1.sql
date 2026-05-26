
-- 1) Fix privilege escalation on usage_tracking
DROP POLICY IF EXISTS "Users can insert own usage" ON public.usage_tracking;
DROP POLICY IF EXISTS "Users can update own non-privileged fields" ON public.usage_tracking;

CREATE POLICY "Users can insert own usage"
ON public.usage_tracking
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND is_pro = false);

CREATE POLICY "Users can update own non-privileged fields"
ON public.usage_tracking
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (
    is_pro = (SELECT ut.is_pro FROM public.usage_tracking ut WHERE ut.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- 2) Revoke EXECUTE on SECURITY DEFINER functions from anon (and public).
-- Keep authenticated access where edge functions / RLS need it.
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_request(text, integer, integer, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_rolling_usage() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.check_rolling_quota() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.increment_usage() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.increment_usage(integer, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.log_request(text, integer, integer, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_rolling_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_rolling_quota() TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_usage(integer, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
