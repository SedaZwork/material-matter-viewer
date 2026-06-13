
-- ── print_jobs additions ──────────────────────────────────────────────
ALTER TABLE public.print_jobs
  ADD COLUMN IF NOT EXISTS ref_code TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'upload',
  ADD COLUMN IF NOT EXISTS generation_prompt TEXT,
  ADD COLUMN IF NOT EXISTS concept_image_url TEXT,
  ADD COLUMN IF NOT EXISTS model_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS generation_metadata JSONB;

-- Generator for ref codes: 0K3D-XXXXXXXX (8 hex chars)
CREATE OR REPLACE FUNCTION public.generate_print_job_ref_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  LOOP
    v_code := '0K3D-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.print_jobs WHERE ref_code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;

-- Backfill any existing rows
UPDATE public.print_jobs
SET ref_code = public.generate_print_job_ref_code()
WHERE ref_code IS NULL;

-- Enforce + default for future rows
ALTER TABLE public.print_jobs
  ALTER COLUMN ref_code SET DEFAULT public.generate_print_job_ref_code(),
  ALTER COLUMN ref_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS print_jobs_ref_code_key ON public.print_jobs (ref_code);

-- Constrain source values
DO $$ BEGIN
  ALTER TABLE public.print_jobs
    ADD CONSTRAINT print_jobs_source_check CHECK (source IN ('upload','generated','recipe'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Storage policies for bucket "0K3D_Modelos_Generados" ──────────────
-- Authenticated users can upload reference images under their own user-id folder.
DO $$ BEGIN
  CREATE POLICY "Users upload own references in 0K3D bucket"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = '0K3D_Modelos_Generados'
      AND (storage.foldername(name))[1] = 'references'
      AND (storage.foldername(name))[2] = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Authenticated users can read their own reference uploads.
DO $$ BEGIN
  CREATE POLICY "Users read own references in 0K3D bucket"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = '0K3D_Modelos_Generados'
      AND (storage.foldername(name))[1] = 'references'
      AND (storage.foldername(name))[2] = auth.uid()::text
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Authenticated users can read generated models that belong to one of their print jobs.
DO $$ BEGIN
  CREATE POLICY "Users read own generated models in 0K3D bucket"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = '0K3D_Modelos_Generados'
      AND (storage.foldername(name))[1] = 'models'
      AND EXISTS (
        SELECT 1 FROM public.print_jobs pj
        WHERE pj.user_id = auth.uid()
          AND pj.model_storage_path = storage.objects.name
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
