export const codeSnippetMethod = 'codeSnippet'

export enum CodeSnippetExecState {
  Running = 'Running',
  Stopped = 'Stopped',
  Loading = 'Loading',
}

export function isCodeSnippetExeecState(state: string): state is CodeSnippetExecState {
  return Object.values(CodeSnippetExecState).includes(state as CodeSnippetExecState)
}

export type CodeSnippetStateHandler = (state: CodeSnippetExecState) => void
export type CodeSnippetStderrHandler = (stderr: string) => void
export type CodeSnippetStdoutHandler = (stdout: string) => void

export type CodeSnippetSubscriptionEvent = 'state' | 'stderr' | 'stdout'
export type CodeSnippetSubscriptionHandler =
  CodeSnippetStateHandler |
  CodeSnippetStderrHandler |
  CodeSnippetStdoutHandler

export type CodeSnippetSubscriptionHandlerType = {
  'state': CodeSnippetStateHandler
  'stderr': CodeSnippetStderrHandler
  'stdout': CodeSnippetStdoutHandler
}

export interface CodeSnippetManager {
  readonly run: (code: string) => Promise<CodeSnippetExecState>
  readonly stop: () => Promise<CodeSnippetExecState>
  readonly installDep: (dep: string) => Promise<void>
  readonly uninstallDep: (dep: string) => Promise<void>
}
