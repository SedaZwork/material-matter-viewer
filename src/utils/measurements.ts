// Unit conversion + validation helpers for user body measurements.

export type LengthUnit = 'mm' | 'in';
export type BodyUnit = 'cm' | 'in';
export type WeightUnit = 'kg' | 'lb';

export const MM_PER_IN = 25.4;
export const CM_PER_IN = 2.54;
export const KG_PER_LB = 0.45359237;

export const toMm = (v: number, u: LengthUnit) => (u === 'mm' ? v : v * MM_PER_IN);
export const fromMm = (v: number, u: LengthUnit) => (u === 'mm' ? v : v / MM_PER_IN);
export const toCm = (v: number, u: BodyUnit) => (u === 'cm' ? v : v * CM_PER_IN);
export const fromCm = (v: number, u: BodyUnit) => (u === 'cm' ? v : v / CM_PER_IN);
export const toKg = (v: number, u: WeightUnit) => (u === 'kg' ? v : v * KG_PER_LB);
export const fromKg = (v: number, u: WeightUnit) => (u === 'kg' ? v : v / KG_PER_LB);

export const round = (v: number, decimals = 2) => {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
};

/** US ring size <-> inner diameter (mm). Standard: circumference(mm) = 36.537 + 2.5535 * size */
export const ringSizeUsToDiameterMm = (size: number) =>
  round((36.537 + 2.5535 * size) / Math.PI, 2);

export const ringDiameterMmToSizeUs = (diameterMm: number) =>
  round((diameterMm * Math.PI - 36.537) / 2.5535, 2);

/** Default inner diameter used when the user has no saved ring measurement. */
export const DEFAULT_RING_INNER_DIAMETER_MM = 18;

/** Canonical (metric) valid ranges. Values outside are rejected. */
export const RANGES: Record<string, { min: number; max: number; unit: string; label: string }> = {
  ring_diameter_mm: { min: 12, max: 25, unit: 'mm', label: 'Inner diameter' },
  ring_size_us: { min: 1, max: 16, unit: '', label: 'US ring size' },
  foot_length_mm: { min: 150, max: 350, unit: 'mm', label: 'Foot length' },
  foot_width_mm: { min: 50, max: 160, unit: 'mm', label: 'Foot width' },
  shoe_size_eu: { min: 20, max: 52, unit: '', label: 'EU shoe size' },
  height_cm: { min: 50, max: 250, unit: 'cm', label: 'Height' },
  weight_kg: { min: 2, max: 300, unit: 'kg', label: 'Weight' },
  chest_cm: { min: 40, max: 200, unit: 'cm', label: 'Chest' },
  waist_cm: { min: 30, max: 200, unit: 'cm', label: 'Waist' },
  hip_cm: { min: 40, max: 200, unit: 'cm', label: 'Hip' },
  wrist_cm: { min: 8, max: 30, unit: 'cm', label: 'Wrist' },
  head_cm: { min: 30, max: 70, unit: 'cm', label: 'Head' },
};

/** Validate a metric value for a field. Returns an error message or null. */
export const validateMetric = (key: string, value: number | null): string | null => {
  if (value === null) return null;
  if (!Number.isFinite(value)) return 'Enter a valid number';
  const r = RANGES[key];
  if (!r) return null;
  if (value < r.min || value > r.max) {
    return `${r.label} must be between ${r.min} and ${r.max}${r.unit ? ' ' + r.unit : ''}`;
  }
  return null;
};

export const parseNumber = (v: string): number | null => {
  const s = v.replace(',', '.').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};
