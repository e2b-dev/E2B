import { EnvVars } from './envVars'
import { CallOpts, SandboxConnection } from './sandboxConnection'
import { withTimeout } from '../utils/promise'

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
  private _finished = false

  private _error = false

  private _exitCode?: number

  /**
   * Whether the process has errored.
   */
  get error(): boolean {
    return this._error
  }


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
   * The stdout from the process.
   */
  get stdout(): string {
    return this.messages
      .filter((out) => !out.error)
      .map((out) => out.line)
      .join(this.delimiter)
  }

  /**
   * The stderr from the process.
   */
  get stderr(): string {
    return this.messages
      .filter((out) => out.error)
      .map((out) => out.line)
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
 * A process running in the sandbox.
 */
export class Process {
  /**
   * @deprecated use .wait() instead
   */
  readonly finished: Promise<ProcessOutput>

  constructor(
    readonly processID: string,
    private readonly sandbox: SandboxConnection,
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
      await this.sandbox._call(processService, 'kill', [this.processID])
    } finally {
      this.triggerExit()
      await this.finished
    }
  }

  /**
   * Waits for the process to finish.
   *
   * @param timeout Timeout for the process to finish in milliseconds
   */
  async wait(timeout?: number): Promise<ProcessOutput> {
    return await withTimeout(() => this.finished, timeout)()
  }

  /**
   * Sends data to the process stdin.
   *
   * @param data Data to send
   * @param opts Call options
   * @param {timeout} [opts.timeout] Timeout for call in milliseconds (default is 60 seconds)
   */
  async sendStdin(data: string, opts?: CallOpts): Promise<void> {
    await this.sandbox._call(
      processService,
      'stdin',
      [this.processID, data],
      opts,
    )
  }
}

export interface ProcessOpts {
  cmd: string;
  onStdout?: (out: ProcessMessage) => Promise<void> | void;
  onStderr?: (out: ProcessMessage) => Promise<void> | void;
  onExit?: (() => Promise<void> | void) | ((exitCode: number) => Promise<void> | void);
  envVars?: EnvVars;
  cwd?: string;
  /** @deprecated Use cwd instead */
  rootDir?: string;
  processID?: string;
  /** Timeout for the process to start in milliseconds */
  timeout?: number;
}

/**
 * Manager for starting and interacting with processes in the sandbox.
 */
export interface ProcessManager {
  /**
   * Starts a new process.
   * @param cmd Command to execute
   * @returns New process
   */
  start(cmd: string): Promise<Process>;
  /**
   * Starts a new process.
   * @param opts Process options
   * @returns New process
   */
  start(opts: ProcessOpts): Promise<Process>;
  /**
   * Starts a new process and wait until it finishes.
   * @param cmd Command to execute
   * @returns New process
   */
  startAndWait(cmd: string): Promise<ProcessOutput>;
  /**
   * Starts a new process and wait until it finishes.
   * @param opts Process options
   * @returns New process
   */
  startAndWait(opts: ProcessOpts): Promise<ProcessOutput>;
}
