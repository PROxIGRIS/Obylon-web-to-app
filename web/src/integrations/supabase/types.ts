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
      admin_actions: {
        Row: {
          command: Database["public"]["Enums"]["admin_command"]
          completed_at: string | null
          created_at: string
          id: string
          issued_by: string | null
          status: Database["public"]["Enums"]["action_status"]
          target_id: string | null
        }
        Insert: {
          command: Database["public"]["Enums"]["admin_command"]
          completed_at?: string | null
          created_at?: string
          id?: string
          issued_by?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          target_id?: string | null
        }
        Update: {
          command?: Database["public"]["Enums"]["admin_command"]
          completed_at?: string | null
          created_at?: string
          id?: string
          issued_by?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_actions_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "workstations"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          id: string
          process_name: string | null
          severity: Database["public"]["Enums"]["alert_severity"]
          timestamp: string
          window_title: string | null
          workstation_id: string | null
        }
        Insert: {
          id?: string
          process_name?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          timestamp?: string
          window_title?: string | null
          workstation_id?: string | null
        }
        Update: {
          id?: string
          process_name?: string | null
          severity?: Database["public"]["Enums"]["alert_severity"]
          timestamp?: string
          window_title?: string | null
          workstation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_workstation_id_fkey"
            columns: ["workstation_id"]
            isOneToOne: false
            referencedRelation: "workstations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_workstation"
            columns: ["workstation_id"]
            isOneToOne: false
            referencedRelation: "workstations"
            referencedColumns: ["id"]
          },
        ]
      }
      allowed_apps: {
        Row: {
          category: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          process_name: string
          updated_at: string
          whitelisted: boolean
        }
        Insert: {
          category?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          process_name: string
          updated_at?: string
          whitelisted?: boolean
        }
        Update: {
          category?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          process_name?: string
          updated_at?: string
          whitelisted?: boolean
        }
        Relationships: []
      }
      evidence_logs: {
        Row: {
          alert_id: string | null
          created_at: string
          id: string
          metadata: Json | null
          screenshot_url: string | null
          webcam_url: string | null
        }
        Insert: {
          alert_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          screenshot_url?: string | null
          webcam_url?: string | null
        }
        Update: {
          alert_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          screenshot_url?: string | null
          webcam_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_logs_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_alert"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      heartbeat_logs: {
        Row: {
          created_at: string
          id: string
          uptime: number | null
          workstation_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          uptime?: number | null
          workstation_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          uptime?: number | null
          workstation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "heartbeat_logs_workstation_id_fkey"
            columns: ["workstation_id"]
            isOneToOne: false
            referencedRelation: "workstations"
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
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          focus_mode: boolean
          id: number
          updated_at: string
        }
        Insert: {
          focus_mode?: boolean
          id?: number
          updated_at?: string
        }
        Update: {
          focus_mode?: boolean
          id?: number
          updated_at?: string
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
      workstations: {
        Row: {
          allowed_app: string | null
          created_at: string
          current_process: string | null
          current_window: string | null
          id: string
          ip_address: string | null
          last_heartbeat: string | null
          name: string
          os_info: Json | null
          status: Database["public"]["Enums"]["workstation_status"]
          updated_at: string
        }
        Insert: {
          allowed_app?: string | null
          created_at?: string
          current_process?: string | null
          current_window?: string | null
          id?: string
          ip_address?: string | null
          last_heartbeat?: string | null
          name: string
          os_info?: Json | null
          status?: Database["public"]["Enums"]["workstation_status"]
          updated_at?: string
        }
        Update: {
          allowed_app?: string | null
          created_at?: string
          current_process?: string | null
          current_window?: string | null
          id?: string
          ip_address?: string | null
          last_heartbeat?: string | null
          name?: string
          os_info?: Json | null
          status?: Database["public"]["Enums"]["workstation_status"]
          updated_at?: string
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
    }
    Enums: {
      action_status:
        | "pending"
        | "sent"
        | "acknowledged"
        | "failed"
        | "completed"
      admin_command: "lock" | "terminate"
      alert_severity: "info" | "warning" | "critical" | "high" | "medium"
      app_role: "admin" | "moderator" | "user" | "dev" | "principal" | "teacher" | "helper"
      workstation_status: "online" | "offline"
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
      action_status: ["pending", "sent", "acknowledged", "failed", "completed"],
      admin_command: ["lock", "terminate"],
      alert_severity: ["info", "warning", "critical", "high", "medium"],
      app_role: ["admin", "moderator", "user", "dev", "principal", "teacher", "helper"],
      workstation_status: ["online", "offline"],
    },
  },
} as const
