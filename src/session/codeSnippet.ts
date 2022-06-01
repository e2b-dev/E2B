export const codeSnippetSubscriptionMethod = 'codeSnippet'

export type CodeSnippetState = 'running' | 'stopped'

export type CodeSnippetStateHandler = (state: CodeSnippetState) => void
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

export interface CodeSnippet {
  run: (code: string) => Promise<void>
  stop: () => Promise<void>
}
