export const codeSnippetSubscriptionMethod = 'codeSnippet'

export enum CodeSnippetExecState {
  Running = 'Running',
  Stopped = 'Stopped',
  Loading = 'Loading',
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
  readonly run: (code: string) => Promise<void>
  readonly stop: () => Promise<void>
}
