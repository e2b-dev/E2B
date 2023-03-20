export interface ThoughtLog {
  id: string
  type: 'thought'
  content: string
  created_at: Date
}

export interface ToolLog {
  id: string
  type: 'tool'
  name: string
  input: string
  start_at: Date
  finish_at?: Date
  output?: string
}

export type Log = ThoughtLog | ToolLog

