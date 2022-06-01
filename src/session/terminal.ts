export const terminalSubscriptionMethod = 'terminal'

export interface TerminalSession {
  sendData: (data: string) => Promise<void>
  resize: ({ cols, rows }: { cols: number, rows: number }) => Promise<void>
  destroy: () => Promise<void>
}

export interface Terminal {
  createSession: (onData: (data: string) => void, activeTerminalID?: string) => Promise<TerminalSession>
}
