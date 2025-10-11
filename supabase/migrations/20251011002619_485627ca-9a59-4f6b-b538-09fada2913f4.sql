-- Add build_volume column to fabricators table
ALTER TABLE fabricators 
ADD COLUMN build_volume_x numeric NOT NULL DEFAULT 200,
ADD COLUMN build_volume_y numeric NOT NULL DEFAULT 200,
ADD COLUMN build_volume_z numeric NOT NULL DEFAULT 200;

COMMENT ON COLUMN fabricators.build_volume_x IS 'Maximum build volume width in mm';
COMMENT ON COLUMN fabricators.build_volume_y IS 'Maximum build volume height in mm';
COMMENT ON COLUMN fabricators.build_volume_z IS 'Maximum build volume depth in mm';