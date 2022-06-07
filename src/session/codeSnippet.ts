export const codeSnippetMethod = 'codeSnippet'

export enum CodeSnippetExecState {
  Running = 'Running',
  Stopped = 'Stopped',
  Loading = 'Loading',
}

export interface DepsErrorResponse {
  error: string
}

export enum OutType {
  Stdout = 'Stdout',
  Stderr = 'Stderr',
}

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

export interface DepOutResponse extends OutResponse {
  dep: string
}
export interface DepStdoutResponse extends DepOutResponse {
  type: OutType.Stdout
}
export interface DepStderrResponse extends DepOutResponse {
  type: OutType.Stderr
}

export type CodeSnippetStateHandler = (state: CodeSnippetExecState) => void
export type CodeSnippetStderrHandler = (o: OutStderrResponse) => void
export type CodeSnippetStdoutHandler = (o: OutStdoutResponse) => void
export type DepsStdoutHandler = (o: DepStdoutResponse) => void
export type DepsStderrHandler = (o: DepStderrResponse) => void
export type DepsChangeHandler = (deps: string[]) => void

export type CodeSnippetSubscriptionHandler =
  CodeSnippetStateHandler |
  CodeSnippetStderrHandler |
  CodeSnippetStdoutHandler |
  DepsStderrHandler |
  DepsStderrHandler |
  DepsChangeHandler

export type CodeSnippetSubscriptionHandlerType = {
  'state': CodeSnippetStateHandler
  'stderr': CodeSnippetStderrHandler
  'stdout': CodeSnippetStdoutHandler
  'depsStdout': DepsStdoutHandler
  'depsStderr': DepsStderrHandler
  'depsChange': DepsChangeHandler
}

export interface CodeSnippetManager {
  readonly run: (code: string) => Promise<CodeSnippetExecState>
  readonly stop: () => Promise<CodeSnippetExecState>
  readonly listDeps: () => Promise<string[]>
  readonly installDep: (dep: string) => Promise<DepsErrorResponse>
  readonly uninstallDep: (dep: string) => Promise<DepsErrorResponse>
}
