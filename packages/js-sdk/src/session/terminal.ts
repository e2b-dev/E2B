import { EnvVars } from './envVars'
import { SessionConnection } from './sessionConnection'

export const terminalService = 'terminal'

export class TerminalOutput {
  private _data = ''

  get data() {
    return this._data
  }

  addData(data: string) {
    this._data += data
  }
}

/**
 * A terminal session running in the environment.
 */
export class Terminal {
  constructor(
    readonly terminalID: string,
    private readonly session: SessionConnection,
    private readonly triggerExit: () => void,
    readonly finished: Promise<TerminalOutput>,
    readonly output: TerminalOutput,
  ) {}

  get data() {
    return this.output.data
  }

  /**
   * Kills the terminal session.
   */
  async kill(): Promise<void> {
    try {
      // TODO: Change the "destroy" to "kill" in devbookd
      await this.session.call(terminalService, 'destroy', [this.terminalID])
    } finally {
      this.triggerExit()
      await this.finished
    }
  }

  /**
   * Sends data to the terminal standard input.
   *
   * @param data Data to send
   */
  async sendData(data: string): Promise<void> {
    await this.session.call(terminalService, 'data', [this.terminalID, data])
  }

  /**
   * Resizes the terminal tty.
   *
   * @param cols Number of columns
   * @param rows Number of rows
   */
  async resize({ cols, rows }: { cols: number; rows: number }): Promise<void> {
    await this.session.call(terminalService, 'resize', [this.terminalID, cols, rows])
  }
}

export type TerminalOpts = {
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
  cwd?: string
  /**
   * @deprecated use cwd instead
   */
  rootDir?: string
  /**
   * Environment variables that will be accessible inside of the terminal.
   */
  envVars?: EnvVars
  /**
   * Timeout in milliseconds (default is 60 seconds)
   */
  timeout?: number
}

export interface TerminalManager {
  readonly start: (opts: TerminalOpts) => Promise<Terminal>
}
