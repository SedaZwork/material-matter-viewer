-- Fix fabricators table public exposure
-- Restrict SELECT to authenticated users only to prevent anonymous data scraping

DROP POLICY IF EXISTS "Fabricators are viewable by everyone" ON fabricators;

-- Only authenticated users can view fabricators (for finding nearby printers)
CREATE POLICY "Authenticated users can view fabricators"
  ON fabricators FOR SELECT
  USING (auth.uid() IS NOT NULL);