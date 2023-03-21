export interface ThoughtLog {
  id: string
  type: 'thought'
  content: string
}

export interface ToolLog {
  type: 'tool'
  name: string
  input: string
  finish_at?: Date
  output?: string
}

export type Log = ThoughtLog | ToolLog
