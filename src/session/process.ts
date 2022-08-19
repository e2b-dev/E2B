import { EnvVars } from './envVars'

export const processMethod = 'process'

export interface Process {
  readonly sendStdin: (data: string) => Promise<void>
  readonly kill: () => Promise<void>
  readonly processID: string
}

export interface ProcessManager {
  readonly start: (
    cmd: string,
    onStdout?: (data: string) => void,
    onStderr?: (data: string) => void,
    envVars?: EnvVars,
    rootdir?: string,
    processID?: string,
  ) => Promise<Process>
}
