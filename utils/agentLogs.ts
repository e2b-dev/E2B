export interface LogFile {
  name: string
  content: AgentLogs
}

export interface AgentLogs {
  context: SystemContext | UserContext | AssistantContext
  functions: {
    name: string
    description?: string
    parameters: { [key: string]: any }
  }
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
