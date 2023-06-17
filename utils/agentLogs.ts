export interface RawFileLog {
  filename: string
  content: string
  metadata: {
    size: number,
    type: string,
    timestamp: number,
    relativePath: string,
  }
}

export interface Log {
  id: string;
  files: LogFile[]
}

export interface LogsMetadata {

}

export interface LogFile {
  name: string
  relativePath: string
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
