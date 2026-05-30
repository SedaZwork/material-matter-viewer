import { materials } from '@/data/materials';
import type { Material } from '@/types/materials';
import { supabaseService } from '@/services/SupabaseService';

/**
 * MaterialRepository provides a thin abstraction over material data.
 * Currently the data lives in a static array, but the methods are prepared
 * for a future Supabase table (`materials`). This keeps the UI unchanged
 * while we transition to a persisted store.
 */
export class MaterialRepository {
  /**
   * Get all materials – returns the static list for now.
   */
  async getAll(): Promise<Material[]> {
    // Future implementation could be:
    // const { data, error } = await supabaseService.client().from('materials').select('*');
    // if (error) throw error;
    // return data as Material[];
    return materials;
  }

  /**
   * Find a material by its id.
   */
  async getById(id: string): Promise<Material | undefined> {
    const all = await this.getAll();
    return all.find((m) => m.id === id);
  }
}
