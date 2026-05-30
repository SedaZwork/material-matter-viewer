import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { config } from '@/config';

/**
 * SupabaseService encapsulates the two Supabase instances (old and new).
 * It provides a tiny wrapper that chooses the appropriate client based on the
 * `useNewInstance` flag exported from the config module.
 *
 * All existing code that imported the raw `supabase` client should be updated
 * to import this service instead, using the methods defined below.
 */
class SupabaseService {
  private primary: SupabaseClient<Database>;
  private secondary?: SupabaseClient<Database>;

  constructor() {
    this.primary = createClient<Database>(
      config.VITE_SUPABASE_URL,
      config.VITE_SUPABASE_ANON_KEY,
      {
        auth: {
          storage: typeof localStorage !== 'undefined' ? localStorage : undefined,
          persistSession: true,
          autoRefreshToken: true,
        },
      },
    );

    if (config.useNewInstance) {
      this.secondary = createClient<Database>(
        config.VITE_SUPABASE_URL_NEW!,
        config.VITE_SUPABASE_ANON_KEY_NEW!,
        {
          auth: {
            storage: typeof localStorage !== 'undefined' ? localStorage : undefined,
            persistSession: true,
            autoRefreshToken: true,
          },
        },
      );
    }
  }

  /**
   * Returns the client that should be used for the current operation.
   * By default we use the primary instance; callers can explicitly request the
   * secondary (new) instance.
   */
  client(useSecondary = false): SupabaseClient<Database> {
    if (useSecondary && this.secondary) {
      return this.secondary;
    }
    return this.primary;
  }

  // Example helper – upload a file to Supabase storage.
  async uploadFile(
    path: string,
    file: File,
    useSecondary = false,
  ): Promise<{ data?: any; error?: any }> {
    return this.client(useSecondary).storage.from('public').upload(path, file);
  }

  // Example helper – invoke a Supabase edge function.
  async invokeFunction(
    fnName: string,
    payload: any,
    useSecondary = false,
  ): Promise<{ data?: any; error?: any }> {
    return this.client(useSecondary).functions.invoke(fnName, {
      body: payload,
      method: 'POST',
    });
  }

  // Pass‑through for auth helpers that the UI currently uses.
  getAuth() {
    return this.primary.auth;
  }
}

// Export a singleton for ease of import throughout the app.
export const supabaseService = new SupabaseService();
