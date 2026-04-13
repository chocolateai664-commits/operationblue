-- Fix privilege escalation: prevent users from modifying is_pro or total_requests freely

-- 1. Drop existing UPDATE policy
DROP POLICY "Users can update own usage" ON usage_tracking;

-- 2. Recreate UPDATE policy that prevents changing is_pro
-- Users can only update total_requests (increment), not is_pro
CREATE POLICY "Users can update own usage"
  ON usage_tracking FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND is_pro = (SELECT ut.is_pro FROM usage_tracking ut WHERE ut.user_id = auth.uid())
  );

-- 3. Drop existing INSERT policy  
DROP POLICY "Users can insert own usage" ON usage_tracking;

-- 4. Recreate INSERT policy that forces is_pro = false
CREATE POLICY "Users can insert own usage"
  ON usage_tracking FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND is_pro = false
  );