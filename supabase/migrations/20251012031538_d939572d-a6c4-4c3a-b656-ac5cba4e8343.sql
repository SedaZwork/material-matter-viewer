-- Fix search_path for calculate_distance function
CREATE OR REPLACE FUNCTION public.calculate_distance(
  lat1 numeric,
  lng1 numeric,
  lat2 numeric,
  lng2 numeric
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  -- Haversine formula for distance calculation in km
  RETURN 6371 * acos(
    cos(radians(lat1)) * cos(radians(lat2)) *
    cos(radians(lng2) - radians(lng1)) +
    sin(radians(lat1)) * sin(radians(lat2))
  );
END;
$$;