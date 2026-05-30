import { z } from 'zod';

// Define the shape of our environment variables.
const EnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string(),
  // Optional second instance – used for the new version copy.
  VITE_SUPABASE_URL_NEW: z.string().url().optional(),
  VITE_SUPABASE_ANON_KEY_NEW: z.string().optional(),
});

// Parse and validate at runtime. In development this will throw early if values are missing.
export const config = EnvSchema.parse(import.meta.env);

// Helper to decide which Supabase client to use.
export const useNewInstance = Boolean(config.VITE_SUPABASE_URL_NEW && config.VITE_SUPABASE_ANON_KEY_NEW);
