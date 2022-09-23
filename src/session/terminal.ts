export const terminalService = 'terminal'

export interface TerminalSession {
  readonly sendData: (data: string) => Promise<void>
  readonly resize: ({ cols, rows }: { cols: number, rows: number }) => Promise<void>
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
    onData: (data: string) => void,
    onChildProcessesChange: ((cps: ChildProcess[]) => void) | undefined,
    size: { cols: number, rows: number },
    terminalID?: string,
  }) => Promise<TerminalSession>
}
