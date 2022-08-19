export const processMethod = 'process'

export interface Process {
  readonly sendStdin: (data: string) => Promise<void>
  readonly kill: () => Promise<void>
  readonly processID: string
}

export interface ProcessManager {
  readonly start: (
    onStdout?: (data: string) => void,
    onStderr?: (data: string) => void,
    processID?: string,
  ) => Promise<Process>
}
