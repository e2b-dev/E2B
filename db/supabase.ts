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
          code: string | null
          created_at: string | null
          id: string
          logs: Json[] | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          id?: string
          logs?: Json[] | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          id?: string
          logs?: Json[] | null
        }
      }
      projects: {
        Row: {
          created_at: string | null
          data: Json | null
          id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id?: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: string
        }
      }
      teams: {
        Row: {
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string | null
        }
      }
      users_teams: {
        Row: {
          created_at: string | null
          team_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          team_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
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
