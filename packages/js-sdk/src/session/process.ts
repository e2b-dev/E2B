import { EnvVars } from './envVars'
import { CallOpts, SessionConnection } from './sessionConnection'

export const processService = 'process'

/**
 * A message from a process.
 */
export class ProcessMessage {
  constructor(
    public readonly line: string,
    /**
     * Unix epoch in nanoseconds
     */
    public readonly timestamp: number,
    public readonly error: boolean,
  ) {
    // eslint-disable-next-line prettier/prettier
  }

  public toString() {
    return this.line
  }
}

/**
 * Output from a process.
 */
export class ProcessOutput {
  private readonly delimiter = '\n'
  private readonly messages: ProcessMessage[] = []
  private _error = false
  private _exitCode?: number
  private _finished = false

  /**
   * The exit code of the process.
   */
  get exitCode(): number | undefined {
    if (!this._finished) {
      throw new Error('Process has not finished yet')
    }
    return this._exitCode
  }

  /**
   * Whether the process has errored.
   */
  get error(): boolean {
    return this._error
  }

  /**
   * The stdout from the process.
   */
  get stdout(): string {
    return this.messages
      .filter(out => !out.error)
      .map(out => out.line)
      .join(this.delimiter)
  }

  /**
   * The stderr from the process.
   */
  get stderr(): string {
    return this.messages
      .filter(out => out.error)
      .map(out => out.line)
      .join(this.delimiter)
  }

  addStdout(message: ProcessMessage) {
    this.insertByTimestamp(message)
  }

  addStderr(message: ProcessMessage) {
    this._error = true
    this.insertByTimestamp(message)
  }

  setExitCode(exitCode: number) {
    this._exitCode = exitCode
    this._finished = true
  }

  private insertByTimestamp(message: ProcessMessage) {
    let i = this.messages.length - 1
    while (i >= 0 && this.messages[i].timestamp > message.timestamp) {
      i -= 1
    }
    this.messages.splice(i + 1, 0, message)
  }
}

/**
 * A process running in the environment.
 */
export class Process {
  /**
   * @deprecated use .wait() instead
   */
  readonly finished: Promise<ProcessOutput>

  constructor(
    readonly processID: string,
    private readonly session: SessionConnection,
    private readonly triggerExit: () => void,
    finished: Promise<ProcessOutput>,
    readonly output: ProcessOutput,
  ) {
    this.finished = finished
  }

  /**
   * Kills the process.
   */
  async kill(): Promise<void> {
    try {
      await this.session.call(processService, 'kill', [this.processID])
    } finally {
      this.triggerExit()
      await this.finished
    }
  }

  /**
   * Waits for the process to finish.
   */
  async wait(): Promise<ProcessOutput> {
    return this.finished
  }

  /**
   * Sends data to the process stdin.
   *
   * @param data Data to send
   * @param opts Call options
   * @param {timeout} [opts.timeout] Timeout in milliseconds (default is 60 seconds)
   */
  async sendStdin(data: string, opts?: CallOpts): Promise<void> {
    await this.session.call(processService, 'stdin', [this.processID, data], opts)
  }
}
export interface ProcessOpts {
  cmd: string
  onStdout?: (out: ProcessMessage) => void
  onStderr?: (out: ProcessMessage) => void
  onExit?: () => void
  envVars?: EnvVars
  cwd?: string
  /** @deprecated use cwd instead */
  rootDir?: string
  processID?: string
  timeout?: number
}

export interface ProcessManager {
  readonly start: (opts: ProcessOpts) => Promise<Process>
}
