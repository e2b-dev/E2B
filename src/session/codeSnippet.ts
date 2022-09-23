import {
  OutStderrResponse,
  OutStdoutResponse,
} from './out'
import { EnvVars } from './envVars'

export const codeSnippetService = 'codeSnippet'

export enum CodeSnippetExecState {
  Running = 'Running',
  Stopped = 'Stopped',
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
