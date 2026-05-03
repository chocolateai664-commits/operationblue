
REVOKE ALL ON FUNCTION public.check_rolling_quota() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_rolling_usage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_rolling_quota() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_rolling_usage() TO authenticated;
