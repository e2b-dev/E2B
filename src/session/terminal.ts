export const terminalMethod = 'terminal'

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
  readonly createSession: (
    onData: (data: string) => void,
    onChildProcessesChange: (cps: ChildProcess[]) => void,
    size: { cols: number, rows: number },
    activeTerminalID?: string,
  ) => Promise<TerminalSession>
}
