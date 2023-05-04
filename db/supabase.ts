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
          config: Json | null
          created_at: string
          enabled: boolean
          id: string
          logs: Json[] | null
          logs_raw: string | null
          project_id: string
          route_id: string | null
          state: Database["public"]["Enums"]["deployment_state"] | null
          url: string | null
        }
        Insert: {
          config?: Json | null
          created_at?: string
          enabled?: boolean
          id?: string
          logs?: Json[] | null
          logs_raw?: string | null
          project_id: string
          route_id?: string | null
          state?: Database["public"]["Enums"]["deployment_state"] | null
          url?: string | null
        }
        Update: {
          config?: Json | null
          created_at?: string
          enabled?: boolean
          id?: string
          logs?: Json[] | null
          logs_raw?: string | null
          project_id?: string
          route_id?: string | null
          state?: Database["public"]["Enums"]["deployment_state"] | null
          url?: string | null
        }
      }
      projects: {
        Row: {
          created_at: string
          data: Json | null
          development_logs: Json[] | null
          id: string
          name: string
          team_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          development_logs?: Json[] | null
          id?: string
          name?: string
          team_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          development_logs?: Json[] | null
          id?: string
          name?: string
          team_id?: string
        }
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
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      deployment_state: "generating" | "deploying" | "finished" | "error"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
