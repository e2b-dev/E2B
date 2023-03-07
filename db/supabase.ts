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
      api_deployments: {
        Row: {
          code: Json | null
          created_at: string | null
          data: Json
          id: number
          logs: Json | null
          team_id: string | null
        }
        Insert: {
          code?: Json | null
          created_at?: string | null
          data: Json
          id?: number
          logs?: Json | null
          team_id?: string | null
        }
        Update: {
          code?: Json | null
          created_at?: string | null
          data?: Json
          id?: number
          logs?: Json | null
          team_id?: string | null
        }
      }
      api_keys: {
        Row: {
          api_key: string
          owner_id: string
        }
        Insert: {
          api_key: string
          owner_id: string
        }
        Update: {
          api_key?: string
          owner_id?: string
        }
      }
      apps: {
        Row: {
          created_at: string
          id: string
          repository_branch: string | null
          repository_id: number | null
          repository_path: string
          subdomain: string | null
          team_id: string | null
          title: string | null
        }
        Insert: {
          created_at?: string
          id: string
          repository_branch?: string | null
          repository_id?: number | null
          repository_path?: string
          subdomain?: string | null
          team_id?: string | null
          title?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          repository_branch?: string | null
          repository_id?: number | null
          repository_path?: string
          subdomain?: string | null
          team_id?: string | null
          title?: string | null
        }
      }
      apps_content: {
        Row: {
          app_id: string
          content: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          app_id: string
          content?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          app_id?: string
          content?: Json | null
          created_at?: string
          updated_at?: string
        }
      }
      apps_feedback: {
        Row: {
          appId: string
          created_at: string
          feedback: string | null
          id: number
          properties: Json | null
        }
        Insert: {
          appId: string
          created_at?: string
          feedback?: string | null
          id?: number
          properties?: Json | null
        }
        Update: {
          appId?: string
          created_at?: string
          feedback?: string | null
          id?: number
          properties?: Json | null
        }
      }
      code_snippets: {
        Row: {
          code: string | null
          created_at: string
          creator_id: string
          env_vars: Json
          id: string
          template: string
          title: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          creator_id: string
          env_vars?: Json
          id: string
          template?: string
          title?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          creator_id?: string
          env_vars?: Json
          id?: string
          template?: string
          title?: string
        }
      }
      envs: {
        Row: {
          code_snippet_id: string | null
          deps: string[] | null
          id: string
          state: Database["public"]["Enums"]["env_state"] | null
          template: string | null
        }
        Insert: {
          code_snippet_id?: string | null
          deps?: string[] | null
          id: string
          state?: Database["public"]["Enums"]["env_state"] | null
          template?: string | null
        }
        Update: {
          code_snippet_id?: string | null
          deps?: string[] | null
          id?: string
          state?: Database["public"]["Enums"]["env_state"] | null
          template?: string | null
        }
      }
      github_repositories: {
        Row: {
          installated_at: string
          installation_id: number
          repository_fullname: string
          repository_id: number
        }
        Insert: {
          installated_at?: string
          installation_id: number
          repository_fullname: string
          repository_id?: number
        }
        Update: {
          installated_at?: string
          installation_id?: number
          repository_fullname?: string
          repository_id?: number
        }
      }
      published_code_snippets: {
        Row: {
          code: string
          code_snippet_id: string
          env_vars: Json
          id: string
          published_at: string | null
          template: string
          title: string
        }
        Insert: {
          code?: string
          code_snippet_id: string
          env_vars?: Json
          id?: string
          published_at?: string | null
          template?: string
          title?: string
        }
        Update: {
          code?: string
          code_snippet_id?: string
          env_vars?: Json
          id?: string
          published_at?: string | null
          template?: string
          title?: string
        }
      }
      slack_installations: {
        Row: {
          created_at: string
          devbook_app_id: string
          id: string
          installation_data: Json
        }
        Insert: {
          created_at?: string
          devbook_app_id: string
          id: string
          installation_data: Json
        }
        Update: {
          created_at?: string
          devbook_app_id?: string
          id?: string
          installation_data?: Json
        }
      }
      teams: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string | null
        }
      }
      user_feedback: {
        Row: {
          created_at: string | null
          feedback: string | null
          id: number
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          feedback?: string | null
          id?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          feedback?: string | null
          id?: number
          user_id?: string | null
        }
      }
      users: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
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
      env_state: "Building" | "Failed" | "Done" | "None"
      template:
        | "Nodejs"
        | "Go"
        | "Bash"
        | "Python3"
        | "Java"
        | "Rust"
        | "Perl"
        | "PHP"
        | "Ansys"
        | "Typescript"
      template_old:
        | "None"
        | "Nodejs"
        | "Go"
        | "Bash"
        | "Python"
        | "Java"
        | "Rust"
        | "Perl"
        | "PHP"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
