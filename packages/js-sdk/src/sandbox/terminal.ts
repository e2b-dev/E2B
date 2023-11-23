import { EnvVars } from './envVars'
import { SandboxConnection } from './sandboxConnection'

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
 * A terminal session running in the sandbox.
 *
 */
export class Terminal {
  /**
   * @deprecated use .wait() instead
   */
  readonly finished: Promise<TerminalOutput>

  constructor(
    readonly terminalID: string,
    private readonly sandbox: SandboxConnection,
    private readonly triggerExit: () => void,
    finished: Promise<TerminalOutput>,
    readonly output: TerminalOutput,
  ) {
    this.finished = finished
  }

  get data() {
    return this.output.data
  }

  /**
   * Kills the terminal session.
   */
  async kill(): Promise<void> {
    try {
      // TODO: Change the "destroy" to "kill" in devbookd
      await this.sandbox._call(terminalService, 'destroy', [this.terminalID])
    } finally {
      this.triggerExit()
      await this.finished
    }
  }

  /**
   * Waits for the terminal to finish.
   */
  async wait(): Promise<TerminalOutput> {
    return this.finished
  }

  /**
   * Sends data to the terminal standard input.
   *
   * @param data Data to send
   */
  async sendData(data: string): Promise<void> {
    await this.sandbox._call(terminalService, 'data', [this.terminalID, data])
  }

  /**
   * Resizes the terminal tty.
   *
   * @param cols Number of columns
   * @param rows Number of rows
   */
  async resize({ cols, rows }: { cols: number; rows: number }): Promise<void> {
    await this.sandbox._call(terminalService, 'resize', [
      this.terminalID,
      cols,
      rows,
    ])
  }
}

export type TerminalOpts = {
  onData: (data: string) => Promise<void> | void;
  onExit?: () => Promise<void> | void;
  size: { cols: number; rows: number };
  terminalID?: string;
  /**
   * If the `cmd` parameter is defined it will be executed as a command
   * and this terminal session will exit when the command exits.
   */
  cmd?: string;
  /**
   * Working directory where will the terminal start.
   */
  cwd?: string;
  /**
   * @deprecated use cwd instead
   */
  rootDir?: string;
  /**
   * Environment variables that will be accessible inside of the terminal.
   */
  envVars?: EnvVars;
  /**
   * Timeout for terminal start in milliseconds (default is 60 seconds)
   */
  timeout?: number;
};

/**
 * Manager for starting and interacting with terminal sessions in the sandbox.
 */
export interface TerminalManager {
  start(opts: TerminalOpts): Promise<Terminal>;
}
