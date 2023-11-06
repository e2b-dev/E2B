export const codeSnippetService = 'codeSnippet'

export interface OpenPort {
  state: string
  ip: string
  port: number
}

export type ScanOpenedPortsHandler = (ports: OpenPort[]) => Promise<void> | void
