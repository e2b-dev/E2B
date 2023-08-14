export enum LogType {
  Thought = 'thought',
  Tool = 'tool',
}

export enum ToolName {
  AskHuman = 'AskHuman',
  InstallNPMDependencies = 'InstallNPMDependencies',
  WriteJavaScriptCode = 'WriteJavaScriptCode',
  RunSavedCode = 'RunSavedCode',
  LetHumanChoose = 'LetHumanChoose',
  Curl = 'Curl',
  SaveFile = 'SaveFile',
  ReadFile = 'ReadFile',
  DeleteFile = 'DeleteFile',
  DeleteDirectory = 'DeleteDirectory',
  ListDirectory = 'ListDirectory',
  RunTerminalCommand = 'RunTerminalCommand',
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
  tool_name: ToolName
  tool_input: string
  tool_output?: string
  finish_at?: Date
}

export type Log = ThoughtLog | ToolLog
