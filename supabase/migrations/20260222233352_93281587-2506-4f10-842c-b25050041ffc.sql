
-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view fabricators" ON public.fabricators;

-- Create owner-only SELECT policy
CREATE POLICY "Fabricator owners can view their own profile"
ON public.fabricators
FOR SELECT
USING (auth.uid() = user_id);

-- Create a secure RPC that returns only necessary fabricator data filtered by build volume
CREATE OR REPLACE FUNCTION public.find_matching_fabricators(
  p_min_x numeric,
  p_min_y numeric,
  p_min_z numeric
)
RETURNS TABLE (
  fabricator_id uuid,
  business_name text,
  location_address text,
  location_lat numeric,
  location_lng numeric,
  price_multiplier numeric,
  build_volume_x numeric,
  build_volume_y numeric,
  build_volume_z numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Validate inputs
  IF p_min_x < 0 OR p_min_y < 0 OR p_min_z < 0 THEN
    RAISE EXCEPTION 'Dimensions must be non-negative';
  END IF;
  IF p_min_x > 10000 OR p_min_y > 10000 OR p_min_z > 10000 THEN
    RAISE EXCEPTION 'Dimensions exceed maximum allowed values';
  END IF;

  -- Only return active fabricators with capacity, filtered by build volume
  -- Excludes sensitive fields: current_capacity, user_id, technologies
  RETURN QUERY
  SELECT
    f.id AS fabricator_id,
    f.business_name,
    f.location_address,
    f.location_lat,
    f.location_lng,
    f.price_multiplier,
    f.build_volume_x,
    f.build_volume_y,
    f.build_volume_z
  FROM public.fabricators f
  WHERE f.is_active = true
    AND f.current_capacity >= 20
    AND f.build_volume_x >= p_min_x
    AND f.build_volume_y >= p_min_y
    AND f.build_volume_z >= p_min_z;
END;
$$;
