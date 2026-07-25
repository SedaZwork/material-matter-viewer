
CREATE TABLE public.user_measurements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  ring_diameter_mm NUMERIC,
  ring_size_us NUMERIC,
  foot_length_mm NUMERIC,
  foot_width_mm NUMERIC,
  shoe_size_eu NUMERIC,
  height_cm NUMERIC,
  weight_kg NUMERIC,
  chest_cm NUMERIC,
  waist_cm NUMERIC,
  hip_cm NUMERIC,
  wrist_cm NUMERIC,
  head_cm NUMERIC,
  notes TEXT,
  scan_source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_measurements TO authenticated;
GRANT ALL ON public.user_measurements TO service_role;

ALTER TABLE public.user_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own measurements"
  ON public.user_measurements
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_measurements_updated_at
  BEFORE UPDATE ON public.user_measurements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
