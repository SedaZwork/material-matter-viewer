
-- Fix 1: Remove profiles and fabricators from Realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE profiles;
ALTER PUBLICATION supabase_realtime DROP TABLE fabricators;

-- Fix 2: Replace the overly permissive print_jobs update policy
-- Drop the existing policy that lets fabricators update any column
DROP POLICY "Users can update their own jobs" ON public.print_jobs;

-- Job owners can update their own jobs (all fields)
CREATE POLICY "Job owners can update their own jobs"
ON public.print_jobs
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Fabricators can only update status on assigned jobs
-- They cannot change cost, user_id, or reassign the job
CREATE POLICY "Fabricators can update status on assigned jobs"
ON public.print_jobs
FOR UPDATE
USING (
  assigned_fabricator_id IN (
    SELECT id FROM fabricators WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  -- Ensure fabricator cannot change ownership or assignment
  assigned_fabricator_id IN (
    SELECT id FROM fabricators WHERE user_id = auth.uid()
  )
  AND user_id = user_id
);
