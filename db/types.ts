export enum LogType {
  Thought = 'thought',
  Tool = 'tool',
}

export enum LogName {
  InstallNPMDependencies = 'InstallNPMDependencies',
  RunJavaScriptCode = 'RunJavaScriptCode',
  CurlJavaScriptServer = 'CurlJavaScriptServer',
}

interface BaseLog {
  id: string
  type: LogType
  created_at: Date
}

export interface ThoughtLog extends BaseLog {
  content: string
  type: LogType.Thought,
}

export interface ToolLog extends BaseLog {
  type: LogType.Tool
  name: LogName
  input: string
  finish_at?: Date
  output?: string
}

export type Log = ThoughtLog | ToolLog
