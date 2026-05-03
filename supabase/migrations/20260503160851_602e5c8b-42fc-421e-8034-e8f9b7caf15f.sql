
-- calculate_distance: switch to SECURITY INVOKER (pure math, no privilege needed)
CREATE OR REPLACE FUNCTION public.calculate_distance(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN 6371 * acos(
    cos(radians(lat1)) * cos(radians(lat2)) *
    cos(radians(lng2) - radians(lng1)) +
    sin(radians(lat1)) * sin(radians(lat2))
  );
END;
$$;

-- Revoke anon execute on find_matching_fabricators (must stay SECURITY DEFINER)
REVOKE EXECUTE ON FUNCTION public.find_matching_fabricators(numeric, numeric, numeric) FROM anon;

-- Revoke public execute on trigger functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
