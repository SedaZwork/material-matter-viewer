-- Create enum for fabricator technologies
CREATE TYPE public.fabricator_technology AS ENUM ('FDM', 'SLA', 'SLS', 'MJF', 'Binder_Jetting');

-- Create fabricators table
CREATE TABLE public.fabricators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  location_lat DECIMAL(10, 8) NOT NULL,
  location_lng DECIMAL(11, 8) NOT NULL,
  location_address TEXT NOT NULL,
  technologies fabricator_technology[] NOT NULL,
  current_capacity INTEGER NOT NULL DEFAULT 100, -- percentage 0-100
  price_multiplier DECIMAL(4, 2) NOT NULL DEFAULT 1.00, -- 1.00 = standard price
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create print jobs table
CREATE TABLE public.print_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_name TEXT NOT NULL,
  volume DECIMAL(10, 2) NOT NULL,
  infill INTEGER NOT NULL,
  supports BOOLEAN NOT NULL,
  estimated_print_time DECIMAL(10, 2) NOT NULL,
  base_cost DECIMAL(10, 2) NOT NULL,
  technology fabricator_technology NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, assigned, in_progress, completed, cancelled
  assigned_fabricator_id UUID REFERENCES public.fabricators(id),
  final_cost DECIMAL(10, 2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fabricators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fabricators
CREATE POLICY "Fabricators are viewable by everyone"
  ON public.fabricators FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own fabricator profile"
  ON public.fabricators FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own fabricator profile"
  ON public.fabricators FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for print jobs
CREATE POLICY "Users can view their own jobs"
  ON public.print_jobs FOR SELECT
  USING (auth.uid() = user_id OR assigned_fabricator_id IN (
    SELECT id FROM public.fabricators WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create their own jobs"
  ON public.print_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own jobs"
  ON public.print_jobs FOR UPDATE
  USING (auth.uid() = user_id OR assigned_fabricator_id IN (
    SELECT id FROM public.fabricators WHERE user_id = auth.uid()
  ));

-- Triggers for updated_at
CREATE TRIGGER update_fabricators_updated_at
  BEFORE UPDATE ON public.fabricators
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_print_jobs_updated_at
  BEFORE UPDATE ON public.print_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to find available fabricators for a job
CREATE OR REPLACE FUNCTION public.find_available_fabricators(
  p_technology fabricator_technology,
  p_user_lat DECIMAL DEFAULT NULL,
  p_user_lng DECIMAL DEFAULT NULL
)
RETURNS TABLE (
  fabricator_id UUID,
  business_name TEXT,
  distance_km DECIMAL,
  final_price_multiplier DECIMAL,
  location_address TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id,
    f.business_name,
    CASE 
      WHEN p_user_lat IS NOT NULL AND p_user_lng IS NOT NULL THEN
        ROUND(CAST(
          6371 * acos(
            cos(radians(p_user_lat)) * cos(radians(f.location_lat)) *
            cos(radians(f.location_lng) - radians(p_user_lng)) +
            sin(radians(p_user_lat)) * sin(radians(f.location_lat))
          ) AS NUMERIC
        ), 2)
      ELSE NULL
    END AS distance_km,
    f.price_multiplier,
    f.location_address
  FROM public.fabricators f
  WHERE f.is_active = true
    AND f.current_capacity > 20
    AND p_technology = ANY(f.technologies)
  ORDER BY distance_km NULLS LAST;
END;
$$;