export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      fabricators: {
        Row: {
          accepts_rush_orders: boolean | null
          approval_date: string | null
          build_volume_x: number
          build_volume_y: number
          build_volume_z: number
          business_name: string
          certifications: string[] | null
          city: string
          contact_email: string
          contact_phone: string
          country: string
          created_at: string
          current_capacity: number
          description: string
          id: string
          is_active: boolean
          is_approved: boolean | null
          layer_resolution: number | null
          lead_time: number
          location_address: string
          location_lat: number
          location_lng: number
          materials: string[]
          max_order_value: number | null
          min_order_value: number | null
          postal_code: string
          price_multiplier: number
          quality_standards: string | null
          state: string
          technologies: Database["public"]["Enums"]["fabricator_technology"][]
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          accepts_rush_orders?: boolean | null
          approval_date?: string | null
          build_volume_x?: number
          build_volume_y?: number
          build_volume_z?: number
          business_name: string
          certifications?: string[] | null
          city?: string
          contact_email?: string
          contact_phone?: string
          country?: string
          created_at?: string
          current_capacity?: number
          description?: string
          id?: string
          is_active?: boolean
          is_approved?: boolean | null
          layer_resolution?: number | null
          lead_time?: number
          location_address: string
          location_lat: number
          location_lng: number
          materials?: string[]
          max_order_value?: number | null
          min_order_value?: number | null
          postal_code?: string
          price_multiplier?: number
          quality_standards?: string | null
          state?: string
          technologies: Database["public"]["Enums"]["fabricator_technology"][]
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          accepts_rush_orders?: boolean | null
          approval_date?: string | null
          build_volume_x?: number
          build_volume_y?: number
          build_volume_z?: number
          business_name?: string
          certifications?: string[] | null
          city?: string
          contact_email?: string
          contact_phone?: string
          country?: string
          created_at?: string
          current_capacity?: number
          description?: string
          id?: string
          is_active?: boolean
          is_approved?: boolean | null
          layer_resolution?: number | null
          lead_time?: number
          location_address?: string
          location_lat?: number
          location_lng?: number
          materials?: string[]
          max_order_value?: number | null
          min_order_value?: number | null
          postal_code?: string
          price_multiplier?: number
          quality_standards?: string | null
          state?: string
          technologies?: Database["public"]["Enums"]["fabricator_technology"][]
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      print_jobs: {
        Row: {
          assigned_fabricator_id: string | null
          base_cost: number
          concept_image_url: string | null
          created_at: string
          estimated_print_time: number
          final_cost: number | null
          generation_metadata: Json | null
          generation_prompt: string | null
          id: string
          infill: number
          material_name: string
          model_storage_path: string | null
          ref_code: string
          source: string
          status: string
          supports: boolean
          technology: Database["public"]["Enums"]["fabricator_technology"]
          updated_at: string
          user_id: string
          volume: number
        }
        Insert: {
          assigned_fabricator_id?: string | null
          base_cost: number
          concept_image_url?: string | null
          created_at?: string
          estimated_print_time: number
          final_cost?: number | null
          generation_metadata?: Json | null
          generation_prompt?: string | null
          id?: string
          infill: number
          material_name: string
          model_storage_path?: string | null
          ref_code?: string
          source?: string
          status?: string
          supports: boolean
          technology: Database["public"]["Enums"]["fabricator_technology"]
          updated_at?: string
          user_id: string
          volume: number
        }
        Update: {
          assigned_fabricator_id?: string | null
          base_cost?: number
          concept_image_url?: string | null
          created_at?: string
          estimated_print_time?: number
          final_cost?: number | null
          generation_metadata?: Json | null
          generation_prompt?: string | null
          id?: string
          infill?: number
          material_name?: string
          model_storage_path?: string | null
          ref_code?: string
          source?: string
          status?: string
          supports?: boolean
          technology?: Database["public"]["Enums"]["fabricator_technology"]
          updated_at?: string
          user_id?: string
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "print_jobs_assigned_fabricator_id_fkey"
            columns: ["assigned_fabricator_id"]
            isOneToOne: false
            referencedRelation: "fabricators"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country: string | null
          created_at: string
          display_name: string | null
          id: string
          location_lat: number | null
          location_lng: number | null
          postal_code: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          postal_code?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          postal_code?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_distance: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      find_matching_fabricators: {
        Args: { p_min_x: number; p_min_y: number; p_min_z: number }
        Returns: {
          build_volume_x: number
          build_volume_y: number
          build_volume_z: number
          business_name: string
          fabricator_id: string
          location_address: string
          location_lat: number
          location_lng: number
          price_multiplier: number
        }[]
      }
      generate_print_job_ref_code: { Args: never; Returns: string }
    }
    Enums: {
      fabricator_technology: "FDM" | "SLA" | "SLS" | "MJF" | "Binder_Jetting"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      fabricator_technology: ["FDM", "SLA", "SLS", "MJF", "Binder_Jetting"],
    },
  },
} as const
