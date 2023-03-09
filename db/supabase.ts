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
          created_at: string
          id: string
          logs: Json[] | null
          project_id: string
          route_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          logs?: Json[] | null
          project_id: string
          route_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          logs?: Json[] | null
          project_id?: string
          route_id?: string | null
        }
      }
      projects: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          name: string
          team_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          name?: string
          team_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
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
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
