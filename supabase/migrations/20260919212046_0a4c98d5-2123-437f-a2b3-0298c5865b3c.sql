CREATE TABLE IF NOT EXISTS public.generated_assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ref_code TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('concept_image', 'model')),
  recipe TEXT NOT NULL DEFAULT 'ring',
  prompt TEXT,
  storage_path TEXT,
  source_url TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_assets TO authenticated;
GRANT ALL ON public.generated_assets TO service_role;

ALTER TABLE public.generated_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own generated assets"
ON public.generated_assets FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS generated_assets_user_created_idx
  ON public.generated_assets (user_id, created_at DESC);

CREATE TRIGGER update_generated_assets_updated_at
BEFORE UPDATE ON public.generated_assets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage: own-folder access inside the generated models bucket
CREATE POLICY "Users read their own generated files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = '0K3D_Modelos_Generados'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Users upload into their own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = '0K3D_Modelos_Generados'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Users update their own generated files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = '0K3D_Modelos_Generados'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Users delete their own generated files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = '0K3D_Modelos_Generados'
  AND (storage.foldername(name))[2] = auth.uid()::text
);