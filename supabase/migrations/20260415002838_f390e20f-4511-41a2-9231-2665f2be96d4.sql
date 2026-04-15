
-- 1. usage_tracking: block users from updating is_pro themselves
CREATE POLICY "Users can update own non-privileged fields"
  ON public.usage_tracking
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id AND is_pro = (SELECT ut.is_pro FROM public.usage_tracking ut WHERE ut.user_id = auth.uid()));

-- 2. request_logs: only allow inserts for own user_id, block UPDATE/DELETE
CREATE POLICY "Users can insert own request logs"
  ON public.request_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "No updates on request logs"
  ON public.request_logs
  FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "No deletes on request logs"
  ON public.request_logs
  FOR DELETE
  TO authenticated
  USING (false);

-- 3. user_roles: block all writes from non-admin users
CREATE POLICY "No insert on user_roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "No update on user_roles"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "No delete on user_roles"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
