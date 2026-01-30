-- Fix 1: Add comment documenting intentional no-delete behavior for audit trail
COMMENT ON TABLE print_jobs IS 'Print jobs are never deleted for audit trail purposes. Use status=cancelled for cancellation instead of deletion.';

-- Fix 2: Secure the handle_new_user function with input validation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_display_name TEXT;
BEGIN
  -- Extract and validate display_name from user metadata
  v_display_name := NEW.raw_user_meta_data ->> 'display_name';
  
  -- Sanitize: trim whitespace and enforce maximum length
  IF v_display_name IS NOT NULL THEN
    v_display_name := TRIM(v_display_name);
    
    -- Enforce maximum length of 100 characters
    IF LENGTH(v_display_name) > 100 THEN
      v_display_name := SUBSTRING(v_display_name FROM 1 FOR 100);
    END IF;
    
    -- Reject if empty after trimming
    IF LENGTH(v_display_name) = 0 THEN
      v_display_name := NULL;
    END IF;
  END IF;
  
  -- Insert with validated data
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, v_display_name);
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't block user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Fix 3: Drop the unused find_available_fabricators function that bypasses RLS
-- The application already uses direct queries with RLS enforcement
DROP FUNCTION IF EXISTS public.find_available_fabricators(fabricator_technology, DECIMAL, DECIMAL);

-- Fix 4: Add check constraint on profiles.display_name for data integrity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'display_name_length'
  ) THEN
    ALTER TABLE profiles
    ADD CONSTRAINT display_name_length CHECK (display_name IS NULL OR LENGTH(display_name) <= 100);
  END IF;
END $$;