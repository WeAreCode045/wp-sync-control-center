export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sync_conflicts: {
        Row: {
          conflict_data: Json
          conflict_type: string
          created_at: string
          id: string
          resolution: string | null
          resolved_at: string | null
          sync_operation_id: string
          table_name: string
        }
        Insert: {
          conflict_data: Json
          conflict_type: string
          created_at?: string
          id?: string
          resolution?: string | null
          resolved_at?: string | null
          sync_operation_id: string
          table_name: string
        }
        Update: {
          conflict_data?: Json
          conflict_type?: string
          created_at?: string
          id?: string
          resolution?: string | null
          resolved_at?: string | null
          sync_operation_id?: string
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_conflicts_sync_operation_id_fkey"
            columns: ["sync_operation_id"]
            isOneToOne: false
            referencedRelation: "sync_operations"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_operations: {
        Row: {
          completed_at: string | null
          components: Json
          created_by: string
          error_message: string | null
          id: string
          operation_type: string
          progress: number | null
          project_id: string
          source_environment: string
          started_at: string | null
          status: string
          target_environment: string
        }
        Insert: {
          completed_at?: string | null
          components: Json
          created_by: string
          error_message?: string | null
          id?: string
          operation_type: string
          progress?: number | null
          project_id: string
          source_environment: string
          started_at?: string | null
          status?: string
          target_environment: string
        }
        Update: {
          completed_at?: string | null
          components?: Json
          created_by?: string
          error_message?: string | null
          id?: string
          operation_type?: string
          progress?: number | null
          project_id?: string
          source_environment?: string
          started_at?: string | null
          status?: string
          target_environment?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_operations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      wp_environments: {
        Row: {
          created_at: string
          db_host: string | null
          db_name: string | null
          db_password: string | null
          db_user: string | null
          environment_type: string
          id: string
          last_connected_at: string | null
          name: string
          password: string
          project_id: string
          ssh_host: string | null
          ssh_password: string | null
          ssh_port: number | null
          ssh_private_key: string | null
          ssh_username: string | null
          status: string | null
          updated_at: string
          url: string
          username: string
          wp_cli_path: string | null
          wp_root_path: string | null
        }
        Insert: {
          created_at?: string
          db_host?: string | null
          db_name?: string | null
          db_password?: string | null
          db_user?: string | null
          environment_type: string
          id?: string
          last_connected_at?: string | null
          name: string
          password: string
          project_id: string
          ssh_host?: string | null
          ssh_password?: string | null
          ssh_port?: number | null
          ssh_private_key?: string | null
          ssh_username?: string | null
          status?: string | null
          updated_at?: string
          url: string
          username: string
          wp_cli_path?: string | null
          wp_root_path?: string | null
        }
        Update: {
          created_at?: string
          db_host?: string | null
          db_name?: string | null
          db_password?: string | null
          db_user?: string | null
          environment_type?: string
          id?: string
          last_connected_at?: string | null
          name?: string
          password?: string
          project_id?: string
          ssh_host?: string | null
          ssh_password?: string | null
          ssh_port?: number | null
          ssh_private_key?: string | null
          ssh_username?: string | null
          status?: string | null
          updated_at?: string
          url?: string
          username?: string
          wp_cli_path?: string | null
          wp_root_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wp_environments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
