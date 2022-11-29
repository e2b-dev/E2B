import { EnvVars } from './envVars'

export const terminalService = 'terminal'

export interface TerminalSession {
  readonly sendData: (data: string) => Promise<void>
  readonly resize: ({ cols, rows }: { cols: number; rows: number }) => Promise<void>
  readonly destroy: () => Promise<void>
  readonly terminalID: string
}

export interface ChildProcess {
  cmd: string
  pid: number
}

export interface TerminalManager {
  readonly killProcess: (pid: number) => Promise<void>
  readonly createSession: (opts: {
    onData: (data: string) => void
    onExit?: () => void
    onChildProcessesChange?: (cps: ChildProcess[]) => void
    size: { cols: number; rows: number }
    terminalID?: string
    /**
     * If the `cmd` parameter is defined it will be executed as a command
     * and this terminal session will exit when the command exits.
     */
    cmd?: string
    /**
     * Working directory where will the terminal start.
     */
    rootdir?: string
    /**
     * Environment variables that will be accessible inside of the terminal.
     */
    envVars?: EnvVars
  }) => Promise<TerminalSession>
}
