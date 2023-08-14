import { EnvVars } from './envVars'

export const terminalService = 'terminal'

export interface Terminal {
  readonly sendData: (data: string) => Promise<void>
  readonly resize: ({ cols, rows }: { cols: number; rows: number }) => Promise<void>
  readonly kill: () => Promise<void>
  readonly terminalID: string
  readonly finished: Promise<void>
}

export interface TerminalManager {
  readonly start: (opts: {
    onData: (data: string) => void
    onExit?: () => void
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
  }) => Promise<Terminal>
}
