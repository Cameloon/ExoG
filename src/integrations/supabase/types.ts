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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      application_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          application_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["application_status"] | null
          id: string
          notes: string | null
          to_status: Database["public"]["Enums"]["application_status"] | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          application_id: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["application_status"] | null
          id?: string
          notes?: string | null
          to_status?: Database["public"]["Enums"]["application_status"] | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          application_id?: string
          created_at?: string
          from_status?: Database["public"]["Enums"]["application_status"] | null
          id?: string
          notes?: string | null
          to_status?: Database["public"]["Enums"]["application_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "application_audit_log_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "sentinel_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      application_documents: {
        Row: {
          application_id: string
          created_at: string
          doc_type: string
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          user_id: string
        }
        Insert: {
          application_id: string
          created_at?: string
          doc_type: string
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          user_id: string
        }
        Update: {
          application_id?: string
          created_at?: string
          doc_type?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "sentinel_applications"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          preferred_language: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          preferred_language?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          preferred_language?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sentinel_applications: {
        Row: {
          capacity: string
          case_id: string
          created_at: string
          email: string
          experience_years: number
          full_name: string
          id: string
          kyc_status: Database["public"]["Enums"]["kyc_status"]
          motivation: string
          pledge_data: Json
          preferred_language: string | null
          region: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          species_focus: string | null
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          capacity: string
          case_id: string
          created_at?: string
          email: string
          experience_years: number
          full_name: string
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          motivation: string
          pledge_data?: Json
          preferred_language?: string | null
          region: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          species_focus?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          capacity?: string
          case_id?: string
          created_at?: string
          email?: string
          experience_years?: number
          full_name?: string
          id?: string
          kyc_status?: Database["public"]["Enums"]["kyc_status"]
          motivation?: string
          pledge_data?: Json
          preferred_language?: string | null
          region?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          species_focus?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      ward_interest: {
        Row: {
          applicant_id: string
          created_at: string
          id: string
          message: string
          status: Database["public"]["Enums"]["ward_interest_status"]
          updated_at: string
          ward_id: string
        }
        Insert: {
          applicant_id: string
          created_at?: string
          id?: string
          message: string
          status?: Database["public"]["Enums"]["ward_interest_status"]
          updated_at?: string
          ward_id: string
        }
        Update: {
          applicant_id?: string
          created_at?: string
          id?: string
          message?: string
          status?: Database["public"]["Enums"]["ward_interest_status"]
          updated_at?: string
          ward_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ward_interest_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "ward_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      ward_listings: {
        Row: {
          age_estimate: string | null
          background: string
          care_requirements: string
          case_code: string
          common_name: string
          created_at: string
          id: string
          images: string[]
          origin_context: string | null
          owner_id: string
          region: string | null
          scientific_name: string | null
          sex: string | null
          size_estimate: string | null
          space_requirements: string
          status: Database["public"]["Enums"]["ward_status"]
          updated_at: string
          urgency: string
          visibility: Database["public"]["Enums"]["ward_visibility"]
        }
        Insert: {
          age_estimate?: string | null
          background: string
          care_requirements: string
          case_code: string
          common_name: string
          created_at?: string
          id?: string
          images?: string[]
          origin_context?: string | null
          owner_id: string
          region?: string | null
          scientific_name?: string | null
          sex?: string | null
          size_estimate?: string | null
          space_requirements: string
          status?: Database["public"]["Enums"]["ward_status"]
          updated_at?: string
          urgency?: string
          visibility?: Database["public"]["Enums"]["ward_visibility"]
        }
        Update: {
          age_estimate?: string | null
          background?: string
          care_requirements?: string
          case_code?: string
          common_name?: string
          created_at?: string
          id?: string
          images?: string[]
          origin_context?: string | null
          owner_id?: string
          region?: string | null
          scientific_name?: string | null
          sex?: string | null
          size_estimate?: string | null
          space_requirements?: string
          status?: Database["public"]["Enums"]["ward_status"]
          updated_at?: string
          urgency?: string
          visibility?: Database["public"]["Enums"]["ward_visibility"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_approved_sentinel: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      application_status: "pending" | "under_review" | "approved" | "rejected"
      kyc_status: "not_started" | "documents_uploaded" | "verified" | "rejected"
      ward_interest_status:
        | "open"
        | "shortlisted"
        | "declined"
        | "withdrawn"
        | "matched"
      ward_status: "available" | "under_review" | "placed" | "withdrawn"
      ward_visibility: "vetted_only" | "admin_only"
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
      app_role: ["admin", "moderator", "user"],
      application_status: ["pending", "under_review", "approved", "rejected"],
      kyc_status: ["not_started", "documents_uploaded", "verified", "rejected"],
      ward_interest_status: [
        "open",
        "shortlisted",
        "declined",
        "withdrawn",
        "matched",
      ],
      ward_status: ["available", "under_review", "placed", "withdrawn"],
      ward_visibility: ["vetted_only", "admin_only"],
    },
  },
} as const
