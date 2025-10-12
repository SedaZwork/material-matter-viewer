-- Add location fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN postal_code text,
ADD COLUMN country text,
ADD COLUMN location_lat numeric,
ADD COLUMN location_lng numeric;

-- Create function to geocode postal code (simplified - you'll need to call an external API in practice)
CREATE OR REPLACE FUNCTION public.calculate_distance(
  lat1 numeric,
  lng1 numeric,
  lat2 numeric,
  lng2 numeric
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
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