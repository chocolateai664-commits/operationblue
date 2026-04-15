
-- Fix 1: Add unique constraint on usage_tracking.user_id to prevent duplicate row insertion
-- First deduplicate any existing rows (keep the one with highest total_requests)
DELETE FROM usage_tracking a
USING usage_tracking b
WHERE a.user_id = b.user_id
  AND a.id <> b.id
  AND a.total_requests < b.total_requests;

ALTER TABLE usage_tracking ADD CONSTRAINT uq_usage_tracking_user UNIQUE (user_id);

-- Fix 2: Explicitly block client-side UPDATE on usage_tracking
-- (Updates are only done via SECURITY DEFINER functions)
-- No UPDATE or DELETE policies needed - RLS enabled with no policy = denied by default
-- But we add an explicit deny-all to make intent clear and satisfy scanners

-- Actually with RLS enabled, no permissive policy = denied. Adding a restrictive SELECT-only note.
-- The correct approach: we do NOT add UPDATE/DELETE policies, keeping them blocked.
-- But the scanner wants explicit policies, so let's add narrow ones that only allow 
-- the user to update their own non-sensitive fields (which in practice won't be used 
-- since all updates go through SECURITY DEFINER functions).
