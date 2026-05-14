
-- Trigger to enforce column-level restrictions on print_jobs UPDATE
CREATE OR REPLACE FUNCTION public.enforce_print_jobs_update_restrictions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_owner BOOLEAN;
  v_is_assigned_fabricator BOOLEAN;
BEGIN
  v_is_owner := (auth.uid() = OLD.user_id);
  v_is_assigned_fabricator := EXISTS (
    SELECT 1 FROM public.fabricators f
    WHERE f.id = OLD.assigned_fabricator_id
      AND f.user_id = auth.uid()
  );

  -- Immutable for everyone: ownership and core job spec
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'user_id cannot be changed';
  END IF;
  IF NEW.material_name IS DISTINCT FROM OLD.material_name
     OR NEW.volume IS DISTINCT FROM OLD.volume
     OR NEW.infill IS DISTINCT FROM OLD.infill
     OR NEW.supports IS DISTINCT FROM OLD.supports
     OR NEW.estimated_print_time IS DISTINCT FROM OLD.estimated_print_time
     OR NEW.technology IS DISTINCT FROM OLD.technology
     OR NEW.base_cost IS DISTINCT FROM OLD.base_cost
     OR NEW.final_cost IS DISTINCT FROM OLD.final_cost
     OR NEW.assigned_fabricator_id IS DISTINCT FROM OLD.assigned_fabricator_id THEN
    -- Fabricators can never change these
    IF v_is_assigned_fabricator AND NOT v_is_owner THEN
      RAISE EXCEPTION 'Fabricators may only update the job status';
    END IF;
    -- Owners cannot change cost or assignment either
    IF v_is_owner THEN
      RAISE EXCEPTION 'Cost, assignment, and job specification fields are immutable after creation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS print_jobs_update_restrictions ON public.print_jobs;
CREATE TRIGGER print_jobs_update_restrictions
BEFORE UPDATE ON public.print_jobs
FOR EACH ROW
EXECUTE FUNCTION public.enforce_print_jobs_update_restrictions();
