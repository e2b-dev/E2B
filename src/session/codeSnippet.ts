export const codeSnippetMethod = 'codeSnippet'

export enum CodeSnippetExecState {
  Running = 'Running',
  Stopped = 'Stopped',
  Loading = 'Loading',
}

export enum OutType {
  Stdout = 'Stdout',
  Stderr = 'Stderr',
}

export type EnvVars = { [key: string]: string }

export interface OutResponse {
  type: OutType
  // Unix epoch in nanoseconds
  timestamp: number
  line: string
}
export interface OutStdoutResponse extends OutResponse {
  type: OutType.Stdout
}
export interface OutStderrResponse extends OutResponse {
  type: OutType.Stderr
}

export interface OpenedPort {
  State: string
  Ip: string
  Port: number
}

export type CodeSnippetStateHandler = (state: CodeSnippetExecState) => void
export type CodeSnippetStderrHandler = (o: OutStderrResponse) => void
export type CodeSnippetStdoutHandler = (o: OutStdoutResponse) => void
export type ScanOpenedPortsHandler = (ports: OpenedPort[]) => void

export type CodeSnippetSubscriptionHandler =
  CodeSnippetStateHandler |
  CodeSnippetStderrHandler |
  CodeSnippetStdoutHandler |
  ScanOpenedPortsHandler

export type CodeSnippetSubscriptionHandlerType = {
  'state': CodeSnippetStateHandler
  'stderr': CodeSnippetStderrHandler
  'stdout': CodeSnippetStdoutHandler
  'scanOpenedPorts': ScanOpenedPortsHandler
}

export interface CodeSnippetManager {
  readonly run: (code: string, envVars?: EnvVars) => Promise<CodeSnippetExecState>
  readonly stop: () => Promise<CodeSnippetExecState>
}
