import { EnvVars } from './envVars'
import {
  OutStdoutResponse,
  OutStderrResponse,
} from './out'

export const processMethod = 'process'

export interface Process {
  readonly sendStdin: (data: string) => Promise<void>
  readonly kill: () => Promise<void>
  readonly processID: string
}

export interface ProcessManager {
  readonly start: (opts: {
    cmd: string,
    onStdout?: (o: OutStdoutResponse) => void,
    onStderr?: (o: OutStderrResponse) => void,
    onExit?: () => void,
    envVars?: EnvVars,
    rootdir?: string,
  }) => Promise<Process>
}
