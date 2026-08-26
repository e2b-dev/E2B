import { Sandbox as BaseSandbox, InvalidArgumentError, TimeoutError } from 'e2b'

import {
  Result,
  Execution,
  OutputMessage,
  parseOutput,
  extractError,
  ExecutionError,
} from './messaging'
import {
  formatExecutionTimeoutError,
  formatRequestTimeoutError,
  isConnectionClosedError,
  readLines,
} from './utils'
import { JUPYTER_PORT, DEFAULT_TIMEOUT_MS } from './consts'

/**
 * Represents a context for code execution.
 */
export type Context = {
  /**
   * The ID of the context.
   */
  id: string
  /**
   * The language of the context.
   */
  language: string
  /**
   * The working directory of the context.
   */
  cwd: string
}

/* eslint-disable @typescript-eslint/ban-types */
/**
 * Supported language for code execution.
 */
export type RunCodeLanguage =
  | 'python'
  | 'javascript'
  | 'typescript'
  | 'r'
  | 'java'
  | 'bash'
  | (string & {})
/* eslint-enable @typescript-eslint/ban-types */

/**
 * Options for running code.
 */
export interface RunCodeOpts {
  /**
   * Callback for handling stdout messages.
   */
  onStdout?: (output: OutputMessage) => Promise<any> | any
  /**
   * Callback for handling stderr messages.
   */
  onStderr?: (output: OutputMessage) => Promise<any> | any
  /**
   * Callback for handling the final execution result.
   */
  onResult?: (data: Result) => Promise<any> | any
  /**
   * Callback for handling the `ExecutionError` object.
   */
  onError?: (error: ExecutionError) => Promise<any> | any
  /**
   * Custom environment variables for code execution.
   *
   * @default {}
   */
  envs?: Record<string, string>
  /**
   * Timeout for the code execution in **milliseconds**.
   *
   * @default 60_000 // 60 seconds
   */
  timeoutMs?: number
  /**
   * Timeout for the request in **milliseconds**.
   *
   * @default 30_000 // 30 seconds
   */
  requestTimeoutMs?: number
}

/**
 * Options for creating a code context.
 */
export interface CreateCodeContextOpts {
  /**
   * Working directory for the context.
   *
   * @default /home/user
   */
  cwd?: string
  /**
   * Language for the context.
   *
   * @default python
   */
  language?: RunCodeLanguage
  /**
   * Timeout for the request in **milliseconds**.
   *
   * @default 30_000 // 30 seconds
   */
  requestTimeoutMs?: number
}

/**
 * E2B cloud sandbox is a secure and isolated cloud environment.
 *
 * The sandbox allows you to:
 * - Access Linux OS
 * - Create, list, and delete files and directories
 * - Run commands
 * - Run isolated code
 * - Access the internet
 *
 * Check docs [here](https://e2b.dev/docs).
 *
 * Use {@link Sandbox.create} to create a new sandbox.
 *
 * @example
 * ```ts
 * import { Sandbox } from '@e2b/code-interpreter'
 *
 * const sandbox = await Sandbox.create()
 * ```
 */
export class Sandbox extends BaseSandbox {
  protected static override readonly defaultTemplate: string =
    'code-interpreter-v1'

  protected get jupyterUrl(): string {
    return this.connectionConfig.getSandboxDirectUrl(this.sandboxId, {
      sandboxDomain: this.sandboxDomain,
      envdPort: JUPYTER_PORT,
    })
  }

  /**
   * Run the code for the specified language.
   *
   * Specify the `language` or `context` option to run the code as a different language or in a different `Context`.
   * If no language is specified, Python is used.
   *
   * You can reference previously defined variables, imports, and functions in the code.
   *
   * @param code code to execute.
   * @param opts options for executing the code.
   *
   * @returns `Execution` result object.
   */
  async runCode(
    code: string,
    opts?: RunCodeOpts & {
      /**
       * Language to use for code execution.
       *
       * If not defined, the default Python context is used.
       */
      language?: RunCodeLanguage
    }
  ): Promise<Execution>
  /**
   * Runs the code in the specified context, if not specified, the default context is used.
   *
   * Specify the `language` or `context` option to run the code as a different language or in a different `Context`.
   *
   * You can reference previously defined variables, imports, and functions in the code.
   *
   * @param code code to execute.
   * @param opts options for executing the code
   *
   * @returns `Execution` result object
   */
  async runCode(
    code: string,
    opts?: RunCodeOpts & {
      /**
       * Context to run the code in.
       */
      context?: Context
    }
  ): Promise<Execution>
  async runCode(
    code: string,
    opts?: RunCodeOpts & {
      language?: string
      context?: Context
    }
  ): Promise<Execution> {
    if (opts?.context && opts?.language) {
      throw new InvalidArgumentError(
        'You can provide context or language, but not both at the same time.'
      )
    }

    const controller = new AbortController()

    const requestTimeout =
      opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs

    const reqTimer = requestTimeout
      ? setTimeout(() => {
          controller.abort()
        }, requestTimeout)
      : undefined

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'E2b-Sandbox-Id': this.sandboxId,
      'E2b-Sandbox-Port': JUPYTER_PORT.toString(),
    }

    if (this.trafficAccessToken) {
      headers['E2B-Traffic-Access-Token'] = this.trafficAccessToken
    }
    if (this.envdAccessToken) {
      headers['X-Access-Token'] = this.envdAccessToken
    }

    try {
      const res = await fetch(`${this.jupyterUrl}/execute`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          code,
          context_id: opts?.context?.id,
          language: opts?.language,
          env_vars: opts?.envs,
        }),
        signal: controller.signal,
        keepalive: true,
      })

      const error = await extractError(res)
      if (error) {
        throw error
      }

      if (!res.body) {
        throw new Error(
          `Not response body: ${res.statusText} ${await res?.text()}`
        )
      }

      clearTimeout(reqTimer)

      const bodyTimeout = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS

      const bodyTimer = bodyTimeout
        ? setTimeout(() => {
            controller.abort()
          }, bodyTimeout)
        : undefined

      const execution = new Execution()

      try {
        for await (const chunk of readLines(res.body)) {
          await parseOutput(
            execution,
            chunk,
            opts?.onStdout,
            opts?.onStderr,
            opts?.onResult,
            opts?.onError
          )
        }
      } catch (error) {
        throw formatExecutionTimeoutError(error)
      } finally {
        clearTimeout(bodyTimer)
      }

      return execution
    } catch (error) {
      throw await this.handleRequestError(error)
    }
  }

  /**
   * Creates a new context to run code in.
   *
   * @param opts options for creating the context.
   *
   * @returns context object.
   */
  async createCodeContext(opts?: CreateCodeContextOpts): Promise<Context> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'E2b-Sandbox-Id': this.sandboxId,
        'E2b-Sandbox-Port': JUPYTER_PORT.toString(),
      }

      if (this.trafficAccessToken) {
        headers['E2B-Traffic-Access-Token'] = this.trafficAccessToken
      }

      const res = await fetch(`${this.jupyterUrl}/contexts`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          language: opts?.language,
          cwd: opts?.cwd,
        }),
        keepalive: true,
        signal: this.connectionConfig.getSignal(opts?.requestTimeoutMs),
      })

      const error = await extractError(res)
      if (error) {
        throw error
      }

      return await res.json()
    } catch (error) {
      throw await this.handleRequestError(error)
    }
  }

  /**
   * Removes a context.
   *
   * @param context context to remove.
   *
   * @returns void.
   */
  async removeCodeContext(context: Context | string): Promise<void> {
    try {
      const id = typeof context === 'string' ? context : context.id
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'E2b-Sandbox-Id': this.sandboxId,
        'E2b-Sandbox-Port': JUPYTER_PORT.toString(),
      }

      if (this.trafficAccessToken) {
        headers['E2B-Traffic-Access-Token'] = this.trafficAccessToken
      }

      const res = await fetch(`${this.jupyterUrl}/contexts/${id}`, {
        method: 'DELETE',
        headers,
        keepalive: true,
        signal: this.connectionConfig.getSignal(
          this.connectionConfig.requestTimeoutMs
        ),
      })

      const error = await extractError(res)
      if (error) {
        throw error
      }
    } catch (error) {
      throw await this.handleRequestError(error)
    }
  }

  /**
   * List all contexts.
   *
   * @returns list of contexts.
   */
  async listCodeContexts(): Promise<Context[]> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'E2b-Sandbox-Id': this.sandboxId,
        'E2b-Sandbox-Port': JUPYTER_PORT.toString(),
      }

      if (this.trafficAccessToken) {
        headers['E2B-Traffic-Access-Token'] = this.trafficAccessToken
      }

      const res = await fetch(`${this.jupyterUrl}/contexts`, {
        method: 'GET',
        headers,
        keepalive: true,
        signal: this.connectionConfig.getSignal(
          this.connectionConfig.requestTimeoutMs
        ),
      })

      const error = await extractError(res)
      if (error) {
        throw error
      }

      return await res.json()
    } catch (error) {
      throw await this.handleRequestError(error)
    }
  }

  /**
   * Restart a context.
   *
   * @param context context to restart.
   *
   * @returns void.
   */
  async restartCodeContext(context: Context | string): Promise<void> {
    try {
      const id = typeof context === 'string' ? context : context.id
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'E2b-Sandbox-Id': this.sandboxId,
        'E2b-Sandbox-Port': JUPYTER_PORT.toString(),
      }

      if (this.trafficAccessToken) {
        headers['E2B-Traffic-Access-Token'] = this.trafficAccessToken
      }

      const res = await fetch(`${this.jupyterUrl}/contexts/${id}/restart`, {
        method: 'POST',
        headers,
        keepalive: true,
        signal: this.connectionConfig.getSignal(
          this.connectionConfig.requestTimeoutMs
        ),
      })

      const error = await extractError(res)
      if (error) {
        throw error
      }
    } catch (error) {
      throw await this.handleRequestError(error)
    }
  }

  /**
   * Returns the error to throw for a failed request. If the connection was
   * closed because the sandbox was killed mid-request, returns a descriptive
   * `TimeoutError`. Otherwise falls back to formatting request timeouts and
   * re-throwing the original error.
   */
  private async handleRequestError(error: unknown): Promise<unknown> {
    if (
      isConnectionClosedError(error) &&
      // If the state check itself fails we can't tell whether the sandbox
      // was killed — assume it's running so we re-throw the original error
      // instead of wrongly claiming the sandbox is gone.
      (await this.isRunning().catch(() => true)) === false
    ) {
      return new TimeoutError(
        'The sandbox was killed while the request was in progress. This can happen when the sandbox times out or is killed manually. ' +
          "You can modify the sandbox timeout by passing 'timeoutMs' when starting the sandbox or calling '.setTimeout' on the sandbox with the desired timeout."
      )
    }

    return formatRequestTimeoutError(error)
  }
}
