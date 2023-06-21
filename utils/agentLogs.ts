import { deployments, log_files, log_uploads } from 'db/prisma'

export interface LiteDeploymentLog extends Omit<log_files, 'content'> {
  content: any
  deployments: LiteDeployment
}

export interface LiteDeployment extends deployments {
  log_files: Pick<log_files, 'id' | 'created_at' | 'log_upload_id'>[]
  projects: {
    name: string
  }
}

export interface LiteLogFile extends Omit<log_files, 'content'> {
  content: AgentPromptLogs | AgentNextActionLog | string
}

export interface LiteLogUpload extends Omit<log_uploads, 'log_files'> {
  log_files: LiteLogFile[]
}

export interface AgentPromptLogs {
  logs: (SystemPromptLog | UserPromptLog | AssistantPromptLog)[]
  functions?: AgentFunction[]
}

export interface AgentFunction {
  name: string
  description?: string
  parameters: { [key: string]: any }
}

// This is very specific to AutoGPT logs.
// We'll generalize later.
export interface AgentNextActionLog {
  thoughts: {
    text: string
    reasoning: string
    plan: string
    criticism: string
    speaker: string
  }
  command: {
    name: string
    args: { [key: string]: string }
  }
}

export interface SystemPromptLog {
  role: 'system'
  content: string
}

export interface UserPromptLog {
  role: 'user'
  content: string
}

export interface AssistantPromptLog {
  role: 'assistant'
  content: string
  function_call?: {
    name: string
    arguments: string
  }
}
