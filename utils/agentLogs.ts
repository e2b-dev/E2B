export interface RawFileLog {
  filename: string
  content: string
}

export interface LogFile {
  id: string
  name: string
}

export interface AgentLogs {
  context: (SystemContext | UserContext | AssistantContext)[]
  functions: AgentFunction[]
}

export interface AgentFunction {
  name: string
  description?: string
  parameters: { [key: string]: any }
}

export interface SystemContext {
  role: 'system'
  content: string
}

export interface UserContext {
  role: 'user'
  content: string
}

export interface AssistantContext {
  role: 'user'
  content: string
  function_call: {
    name: string
    arguments: { [argName: string]: string }
  }
}

export interface PostLogs {
  logFiles: RawFileLog[]
  projectID: string
}

export interface PostLogsResponse {
  id: string
}
