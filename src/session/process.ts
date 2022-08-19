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
  readonly start: (
    cmd: string,
    onStdout?: (o: OutStdoutResponse) => void,
    onStderr?: (o: OutStderrResponse) => void,
    envVars?: EnvVars,
    rootdir?: string,
    processID?: string,
  ) => Promise<Process>
}
