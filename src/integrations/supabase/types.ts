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
      // Hand-added until types are regenerated from the live project
      // (migration 00014_care_logs.sql). Regenerate: supabase gen types.
      care_logs: {
        Row: {
          id: string
          ward_id: string
          author_id: string
          author_name: string
          type: string
          note: string
          rationale: string
          metrics: Json
          prev_hash: string | null
          hash: string
          created_at: string
        }
        Insert: {
          id?: string
          ward_id: string
          author_id: string
          author_name: string
          type: string
          note: string
          rationale?: string
          metrics?: Json
          prev_hash?: string | null
          hash: string
          created_at?: string
        }
        Update: {
          id?: string
          ward_id?: string
          author_id?: string
          author_name?: string
          type?: string
          note?: string
          rationale?: string
          metrics?: Json
          prev_hash?: string | null
          hash?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_logs_ward_id_fkey"
            columns: ["ward_id"]
            isOneToOne: false
            referencedRelation: "ward_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      // Hand-added until types are regenerated from the live project
      // (migration 00011_change_log.sql). Regenerate: supabase gen types.
      change_log: {
        Row: {
          id: string
          actor_id: string
          action: string
          table_name: string
          record_id: string
          changed_at: string
        }
        Insert: {
          id?: string
          actor_id: string
          action: string
          table_name: string
          record_id: string
          changed_at?: string
        }
        Update: {
          id?: string
          actor_id?: string
          action?: string
          table_name?: string
          record_id?: string
          changed_at?: string
        }
        Relationships: []
      }
      // Hand-added until types are regenerated from the live project
      // (migration 00003_cites_species.sql). Regenerate: supabase gen types.
      cites_species: {
        Row: {
          id: number
          full_name: string
          rank: string
          class_name: string | null
          order_name: string | null
          family_name: string | null
          genus_name: string | null
          species_name: string | null
          cites_accepted: boolean
          english_names: string[]
          current_listing: string | null
          listing_changes: Json
          created_at: string
        }
        Insert: {
          id?: number
          full_name: string
          rank: string
          class_name?: string | null
          order_name?: string | null
          family_name?: string | null
          genus_name?: string | null
          species_name?: string | null
          cites_accepted?: boolean
          english_names?: string[]
          current_listing?: string | null
          listing_changes?: Json
          created_at?: string
        }
        Update: {
          id?: number
          full_name?: string
          rank?: string
          class_name?: string | null
          order_name?: string | null
          family_name?: string | null
          genus_name?: string | null
          species_name?: string | null
          cites_accepted?: boolean
          english_names?: string[]
          current_listing?: string | null
          listing_changes?: Json
          created_at?: string
        }
        Relationships: []
      }
      // Hand-added until types are regenerated from the live project
      // (migration 00016_staff_wards_and_duties.sql). Regenerate: supabase gen types.
      duties: {
        Row: {
          id: string
          owner_id: string
          case_code: string | null
          title: string
          category: string
          priority: string
          due_at: string | null
          done: boolean
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          case_code?: string | null
          title: string
          category?: string
          priority?: string
          due_at?: string | null
          done?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          case_code?: string | null
          title?: string
          category?: string
          priority?: string
          due_at?: string | null
          done?: boolean
          created_at?: string
        }
        Relationships: []
      }
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
          // ponytail: hand-added (00019_profiles_region.sql)
          region: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          preferred_language?: string | null
          region?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          preferred_language?: string | null
          region?: string | null
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
          // Hand-added (00022_sentinel_tier.sql) until types are regenerated.
          tier: string
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
          tier?: string
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
          tier?: string
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
          consultation_requested: boolean
          created_at: string
          id: string
          message: string
          status: Database["public"]["Enums"]["ward_interest_status"]
          updated_at: string
          ward_id: string
        }
        Insert: {
          applicant_id: string
          consultation_requested?: boolean
          created_at?: string
          id?: string
          message: string
          status?: Database["public"]["Enums"]["ward_interest_status"]
          updated_at?: string
          ward_id: string
        }
        Update: {
          applicant_id?: string
          consultation_requested?: boolean
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
          // Hand-added (00015_ward_cites_listing.sql) until types are regenerated.
          cites_listing: string | null
          common_name: string
          created_at: string
          id: string
          images: string[]
          // Hand-added (00021_care_and_identification.sql) until types are regenerated.
          lab_report_path: string | null
          legal_custody: boolean
          origin_context: string | null
          owner_id: string
          placement_type: Database["public"]["Enums"]["placement_type"]
          quarantine_status: Database["public"]["Enums"]["quarantine_status"]
          quarantine_until: string | null
          region: string | null
          shelter_id: string | null
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
          cites_listing?: string | null
          common_name: string
          created_at?: string
          id?: string
          images?: string[]
          lab_report_path?: string | null
          legal_custody?: boolean
          origin_context?: string | null
          owner_id: string
          placement_type?: Database["public"]["Enums"]["placement_type"]
          quarantine_status?: Database["public"]["Enums"]["quarantine_status"]
          quarantine_until?: string | null
          region?: string | null
          shelter_id?: string | null
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
          cites_listing?: string | null
          common_name?: string
          created_at?: string
          id?: string
          images?: string[]
          lab_report_path?: string | null
          legal_custody?: boolean
          origin_context?: string | null
          owner_id?: string
          placement_type?: Database["public"]["Enums"]["placement_type"]
          quarantine_status?: Database["public"]["Enums"]["quarantine_status"]
          quarantine_until?: string | null
          region?: string | null
          shelter_id?: string | null
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
      identification_requests: {
        Row: {
          common_name: string
          confirmed_listing: string | null
          confirmed_species: string | null
          created_at: string
          created_by: string
          description: string
          id: string
          notes: string
          photos: string[]
          region: string | null
          status: Database["public"]["Enums"]["id_request_status"]
          updated_at: string
        }
        Insert: {
          common_name: string
          confirmed_listing?: string | null
          confirmed_species?: string | null
          created_at?: string
          created_by: string
          description?: string
          id?: string
          notes?: string
          photos?: string[]
          region?: string | null
          status?: Database["public"]["Enums"]["id_request_status"]
          updated_at?: string
        }
        Update: {
          common_name?: string
          confirmed_listing?: string | null
          confirmed_species?: string | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          notes?: string
          photos?: string[]
          region?: string | null
          status?: Database["public"]["Enums"]["id_request_status"]
          updated_at?: string
        }
        Relationships: []
      }
      identification_votes: {
        Row: {
          confidence: string
          created_at: string
          expert_id: string
          id: string
          listing: string | null
          note: string
          request_id: string
          species: string
        }
        Insert: {
          confidence: string
          created_at?: string
          expert_id: string
          id?: string
          listing?: string | null
          note?: string
          request_id: string
          species: string
        }
        Update: {
          confidence?: string
          created_at?: string
          expert_id?: string
          id?: string
          listing?: string | null
          note?: string
          request_id?: string
          species?: string
        }
        Relationships: []
      }
      transport_logs: {
        Row: {
          carrier: string
          checklist: string[]
          created_at: string
          from_location: string
          handler_id: string
          id: string
          mode: string
          notes: string
          to_location: string
          ward_id: string
        }
        Insert: {
          carrier?: string
          checklist?: string[]
          created_at?: string
          from_location?: string
          handler_id: string
          id?: string
          mode?: string
          notes?: string
          to_location?: string
          ward_id: string
        }
        Update: {
          carrier?: string
          checklist?: string[]
          created_at?: string
          from_location?: string
          handler_id?: string
          id?: string
          mode?: string
          notes?: string
          to_location?: string
          ward_id?: string
        }
        Relationships: []
      }
      shelters: {
        Row: {
          id: string
          owner_id: string
          name: string
          kind: Database["public"]["Enums"]["user_kind"]
          region: string
          address: string | null
          lat: number | null
          lng: number | null
          contact_email: string | null
          contact_phone: string | null
          description: string | null
          capacity_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          kind?: Database["public"]["Enums"]["user_kind"]
          region: string
          address?: string | null
          lat?: number | null
          lng?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          description?: string | null
          capacity_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          kind?: Database["public"]["Enums"]["user_kind"]
          region?: string
          address?: string | null
          lat?: number | null
          lng?: number | null
          contact_email?: string | null
          contact_phone?: string | null
          description?: string | null
          capacity_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sentinel_shelter_requests: {
        Row: {
          id: string
          shelter_id: string
          sentinel_id: string
          message: string | null
          status: Database["public"]["Enums"]["shelter_request_status"]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          shelter_id: string
          sentinel_id: string
          message?: string | null
          status?: Database["public"]["Enums"]["shelter_request_status"]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          shelter_id?: string
          sentinel_id?: string
          message?: string | null
          status?: Database["public"]["Enums"]["shelter_request_status"]
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sentinel_shelter_requests_shelter_id_fkey"
            columns: ["shelter_id"]
            isOneToOne: false
            referencedRelation: "shelters"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_shelter_requests: {
        Row: {
          id: string
          user_id: string
          email: string
          display_name: string | null
          status: Database["public"]["Enums"]["shelter_approval_status"]
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email: string
          display_name?: string | null
          status?: Database["public"]["Enums"]["shelter_approval_status"]
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          email?: string
          display_name?: string | null
          status?: Database["public"]["Enums"]["shelter_approval_status"]
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      role_change_log: {
        Row: {
          id: string
          actor_id: string
          target_user_id: string
          role: string
          region: string | null
          changed_at: string
        }
        Insert: {
          id?: string
          actor_id: string
          target_user_id: string
          role: string
          region?: string | null
          changed_at?: string
        }
        Update: {
          id?: string
          actor_id?: string
          target_user_id?: string
          role?: string
          region?: string | null
          changed_at?: string
        }
        Relationships: []
      }
      sentinel_change_requests: {
        Row: {
          id: string
          user_id: string
          requested: Json
          status: string
          reviewer_notes: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          requested: Json
          status?: string
          reviewer_notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          requested?: Json
          status?: string
          reviewer_notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      shelter_directory: {
        Row: {
          id: string
          name: string
          kind: Database["public"]["Enums"]["user_kind"]
          region: string
          description: string | null
          capacity_notes: string | null
          lat: number | null
          lng: number | null
          created_at: string
          updated_at: string
        }
        Relationships: []
      }
    }
    Functions: {
      append_care_log: {
        Args: {
          p_ward_id: string
          p_author_name: string
          p_type: string
          p_note: string
          p_rationale: string
          p_metrics?: Json
        }
        Returns: {
          ward_id: string
          author_name: string
          type: string
          note: string
          rationale: string
          metrics: Json
          hash: string
          created_at: string
        }[]
      }
      has_role: {
        Args: {
          _user_id: string
          _role: string
        }
        Returns: boolean
      }
      is_approved_sentinel: { Args: { _user_id: string }; Returns: boolean }
      is_expert: { Args: { _user_id: string }; Returns: boolean }
      is_gov: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      application_status: "pending" | "under_review" | "approved" | "rejected"
      user_kind: "sentinel" | "shelter" | "gov"
      shelter_request_status: "open" | "accepted" | "declined" | "withdrawn"
      shelter_approval_status: "pending" | "approved" | "rejected"
      kyc_status: "not_started" | "documents_uploaded" | "verified" | "rejected"
      ward_interest_status:
        | "open"
        | "shortlisted"
        | "declined"
        | "withdrawn"
        | "matched"
      ward_status: "available" | "under_review" | "placed" | "withdrawn"
      ward_visibility: "vetted_only" | "admin_only"
      placement_type: "endstelle" | "pflegestelle"
      quarantine_status: "unknown" | "in_quarantine" | "quarantine_safe" | "suspected"
      id_request_status: "open" | "confirmed" | "closed"
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
      placement_type: ["endstelle", "pflegestelle"],
      quarantine_status: [
        "unknown",
        "in_quarantine",
        "quarantine_safe",
        "suspected",
      ],
      id_request_status: ["open", "confirmed", "closed"],
    },
  },
} as const
