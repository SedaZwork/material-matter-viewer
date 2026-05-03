
-- Revoke all default grants, then re-grant only what's needed
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_matching_fabricators(numeric, numeric, numeric) FROM PUBLIC;

-- find_matching_fabricators should only be callable by authenticated users
GRANT EXECUTE ON FUNCTION public.find_matching_fabricators(numeric, numeric, numeric) TO authenticated;
