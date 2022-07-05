export const terminalMethod = 'terminal'

export interface TerminalSession {
  readonly sendData: (data: string) => Promise<void>
  readonly resize: ({ cols, rows }: { cols: number, rows: number }) => Promise<void>
  readonly destroy: () => Promise<void>
}

export interface TerminalManager {
  readonly createSession: (onData: (data: string) => void, size: { cols: number, rows: number }, activeTerminalID?: string) => Promise<TerminalSession>
}
