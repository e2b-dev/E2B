export const codeSnippetMethod = 'codeSnippet'

export enum CodeSnippetExecState {
  Running = 'Running',
  Stopped = 'Stopped',
  Loading = 'Loading',
}

export interface DepsErrorResponse {
  error: string
}

export type CodeSnippetStateHandler = (state: CodeSnippetExecState) => void
export type CodeSnippetStderrHandler = (stderr: string) => void
export type CodeSnippetStdoutHandler = (stdout: string) => void
export type DepsStdoutHandler = (out: { line: string, dep: string }) => void
export type DepsStderrHandler = (out: { line: string, dep: string }) => void
export type DepsChangeHandler = (deps: string[]) => void

export type CodeSnippetSubscriptionEvent = 'state' | 'stderr' | 'stdout'
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
