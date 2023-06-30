export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[]

export interface Database {
  public: {
    Tables: {
      deployments: {
        Row: {
          auth: Json | null
          config: Json | null
          created_at: string
          enabled: boolean
          id: string
          last_finished_prompt: string | null
          logs: Json[] | null
          logs_raw: string | null
          project_id: string
          route_id: string | null
          state: Database["public"]["Enums"]["deployment_state"] | null
          url: string | null
        }
        Insert: {
          auth?: Json | null
          config?: Json | null
          created_at?: string
          enabled?: boolean
          id?: string
          last_finished_prompt?: string | null
          logs?: Json[] | null
          logs_raw?: string | null
          project_id: string
          route_id?: string | null
          state?: Database["public"]["Enums"]["deployment_state"] | null
          url?: string | null
        }
        Update: {
          auth?: Json | null
          config?: Json | null
          created_at?: string
          enabled?: boolean
          id?: string
          last_finished_prompt?: string | null
          logs?: Json[] | null
          logs_raw?: string | null
          project_id?: string
          route_id?: string | null
          state?: Database["public"]["Enums"]["deployment_state"] | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deployments_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      feedback: {
        Row: {
          created_at: string | null
          email: string | null
          id: number
          text: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: number
          text?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: number
          text?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      log_files: {
        Row: {
          content: string
          created_at: string
          deployment_id: string | null
          filename: string
          id: string
          last_modified: string | null
          log_upload_id: string | null
          project_id: string
          relativePath: string
        }
        Insert: {
          content?: string
          created_at?: string
          deployment_id?: string | null
          filename?: string
          id?: string
          last_modified?: string | null
          log_upload_id?: string | null
          project_id: string
          relativePath?: string
        }
        Update: {
          content?: string
          created_at?: string
          deployment_id?: string | null
          filename?: string
          id?: string
          last_modified?: string | null
          log_upload_id?: string | null
          project_id?: string
          relativePath?: string
        }
        Relationships: [
          {
            foreignKeyName: "log_files_deployment_id_fkey"
            columns: ["deployment_id"]
            referencedRelation: "deployments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_files_log_upload_id_fkey"
            columns: ["log_upload_id"]
            referencedRelation: "log_uploads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_files_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      log_uploads: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          project_id: string | null
          tags: Json
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          project_id?: string | null
          tags?: Json
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          project_id?: string | null
          tags?: Json
        }
        Relationships: [
          {
            foreignKeyName: "log_uploads_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      projects: {
        Row: {
          created_at: string
          data: Json | null
          development_logs: Json[] | null
          id: string
          is_default: boolean
          name: string
          slug: string | null
          team_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          development_logs?: Json[] | null
          id?: string
          is_default?: boolean
          name?: string
          slug?: string | null
          team_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          development_logs?: Json[] | null
          id?: string
          is_default?: boolean
          name?: string
          slug?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          }
        ]
      }
      teams: {
        Row: {
          created_at: string
          id: string
          is_default: boolean | null
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
        }
        Relationships: []
      }
      users_teams: {
        Row: {
          created_at: string
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          team_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_teams_team_id_fkey"
            columns: ["team_id"]
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_teams_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      append_array: {
        Args: {
          new_element: Json
          id: string
        }
        Returns: undefined
      }
      get_project_user_ids: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
    }
    Enums: {
      deployment_state: "generating" | "deploying" | "finished" | "error"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
