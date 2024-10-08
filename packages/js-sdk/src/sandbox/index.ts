import { createConnectTransport } from '@connectrpc/connect-web'

import {
  ConnectionOpts,
  ConnectionConfig,
  defaultUsername,
} from '../connectionConfig'
import { createRpcLogger } from '../logs'
import { Filesystem } from './filesystem'
import { Process, Pty } from './process'
import { SandboxApi } from './sandboxApi'
import { EnvdApiClient, handleEnvdApiError } from '../envd/api'

/**
 * Options for creating a new Sandbox.
 */
export interface SandboxOpts extends ConnectionOpts {
  metadata?: Record<string, string>
  envs?: Record<string, string>
  timeoutMs?: number
}

/**
 * E2B cloud sandbox gives your agent a full cloud development environment that's sandboxed.
 *
 * That means:
 * - Access to Linux OS
 * - Using filesystem (create, list, and delete files and dirs)
 * - Run commands
 * - Sandboxed - you can run any code
 * - Access to the internet
 *
 * Check usage docs - https://e2b.dev/docs/sandbox/overview
 *
 * These cloud sandboxes are meant to be used for agents. Like a sandboxed playgrounds, where the agent can do whatever it wants.
 *
 * Use the {@link Sandbox.create} method to create a new sandbox.
 *
 * @example
 * ```ts
 * import { Sandbox } from '@e2b/sdk'
 *
 * const sandbox = await Sandbox.create()
 * ```
 */
export class Sandbox extends SandboxApi {
  protected static readonly defaultTemplate: string = 'base'
  protected static readonly defaultSandboxTimeoutMs = 300_000

  /**
   * Filesystem module for interacting with the sandbox's filesystem
   */
  readonly files: Filesystem
  /**
   * Commands module for interacting with the sandbox's processes
   */
  readonly commands: Process
  /**
   * PTY module for interacting with the sandbox's pseudo-terminal
   */
  readonly pty: Pty

  /**
   * Unique identifier of the sandbox.
   */
  readonly sandboxId: string

  protected readonly envdPort = 49983

  protected readonly connectionConfig: ConnectionConfig
  private readonly envdApiUrl: string
  private readonly envdApi: EnvdApiClient

  /**
   * Use `Sandbox.create()` instead.
   *
   * @hidden
   * @hide
   * @internal
   * @access protected
   */
  constructor(
    opts: Omit<SandboxOpts, 'timeoutMs' | 'envs' | 'metadata'> & {
      sandboxId: string
    }
  ) {
    super()

    this.sandboxId = opts.sandboxId
    this.connectionConfig = new ConnectionConfig(opts)
    this.envdApiUrl = `${
      this.connectionConfig.debug ? 'http' : 'https'
    }://${this.getHost(this.envdPort)}`

    const rpcTransport = createConnectTransport({
      baseUrl: this.envdApiUrl,
      useBinaryFormat: false,
      interceptors: opts?.logger ? [createRpcLogger(opts.logger)] : undefined,
    })

    this.envdApi = new EnvdApiClient({
      apiUrl: this.envdApiUrl,
      logger: opts?.logger,
    })
    this.files = new Filesystem(
      rpcTransport,
      this.envdApi,
      this.connectionConfig
    )
    this.commands = new Process(rpcTransport, this.connectionConfig)
    this.pty = new Pty(rpcTransport, this.connectionConfig)
  }

  /**
   * Creates a new Sandbox from the default `base` sandbox template.
   * @param opts Connection options
   * @returns New Sandbox
   *
   * @example
   * ```ts
   * const sandbox = await Sandbox.create()
   * ```
   * @constructs Sandbox
   */
  static async create<S extends typeof Sandbox>(
    this: S,
    opts?: SandboxOpts
  ): Promise<InstanceType<S>>
  static async create<S extends typeof Sandbox>(
    this: S,
    template: string,
    opts?: SandboxOpts
  ): Promise<InstanceType<S>>
  static async create<S extends typeof Sandbox>(
    this: S,
    templateOrOpts?: SandboxOpts | string,
    opts?: SandboxOpts
  ): Promise<InstanceType<S>> {
    const { template, sandboxOpts } =
      typeof templateOrOpts === 'string'
        ? { template: templateOrOpts, sandboxOpts: opts }
        : { template: this.defaultTemplate, sandboxOpts: templateOrOpts }

    const config = new ConnectionConfig(sandboxOpts)

    const sandboxId = config.debug
      ? 'debug_sandbox_id'
      : await this.createSandbox(
          template,
          sandboxOpts?.timeoutMs ?? this.defaultSandboxTimeoutMs,
          sandboxOpts
        )

    const sbx = new this({ sandboxId, ...config }) as InstanceType<S>
    return sbx
  }

  /**
   * Connects to an existing Sandbox.
   * @param sandboxId Sandbox ID
   * @param opts Connection options
   * @returns Existing Sandbox
   *
   * @example
   * ```ts
   * const sandbox = await Sandbox.create()
   * const sandboxId = sandbox.sandboxId
   *
   * // Another code block
   * const sameSandbox = await Sandbox.connect(sandboxId)
   * ```
   */
  static async connect<S extends typeof Sandbox>(
    this: S,
    sandboxId: string,
    opts?: Omit<SandboxOpts, 'metadata' | 'envs' | 'timeoutMs'>
  ): Promise<InstanceType<S>> {
    const config = new ConnectionConfig(opts)

    const sbx = new this({ sandboxId, ...config }) as InstanceType<S>
    return sbx
  }

  /**
   * Get the hostname for the specified sandbox's port.
   *
   * @param port Port number of a specific port in the sandbox
   * @returns Hostname of the sandbox's port
   * @example
   * ```ts
   * const sandbox = await Sandbox.create()
   * // Start an HTTP server
   * await sandbox.commands.exec('python3 -m http.server 3000')
   * // Get the hostname of the HTTP server
   * const serverURL = sandbox.getHost(3000)
   * ``
   */
  getHost(port: number) {
    if (this.connectionConfig.debug) {
      return `localhost:${port}`
    }

    return `${port}-${this.sandboxId}.${this.connectionConfig.domain}`
  }

  /**
   * Check if the sandbox is running.
   *
   * @returns `true` if the sandbox is running, `false` otherwise
   * @example
   * ```ts
   * const sandbox = await Sandbox.create()
   * await sandbox.isRunning() // Returns true
   *
   * await sandbox.kill()
   * await sandbox.isRunning() // Returns false
   * ```
   */
  async isRunning(
    opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>
  ): Promise<boolean> {
    const signal = this.connectionConfig.getSignal(opts?.requestTimeoutMs)

    const res = await this.envdApi.api.GET('/health', {
      signal,
    })

    if (res.response.status == 502) {
      return false
    }

    const err = await handleEnvdApiError(res)
    if (err) {
      throw err
    }

    return true
  }

  /**
   * Set the sandbox's timeout, after which the sandbox will be automatically killed.
   * The sandbox can be kept alive for a maximum of 24 hours from the time of creation.
   * If you try to set the timeout to a period, which exceeds the maximum limit, the timeout will be set to the maximum limit.
   *
   * @param timeoutMs Duration in milliseconds. Must be between 0 and 86400000 milliseconds (24 hours).
   * @param opts Connection options
   * @returns Promise that resolves when the sandbox is kept alive
   */
  async setTimeout(
    timeoutMs: number,
    opts?: Pick<SandboxOpts, 'requestTimeoutMs'>
  ) {
    if (this.connectionConfig.debug) {
      // Skip timeout in debug mode
      return
    }

    await Sandbox.setTimeout(this.sandboxId, timeoutMs, {
      ...this.connectionConfig,
      ...opts,
    })
  }

  /**
   * Kill the sandbox.
   *
   * @param opts Connection options
   * @returns Promise that resolves when the sandbox is killed
   */
  async kill(opts?: Pick<SandboxOpts, 'requestTimeoutMs'>) {
    if (this.connectionConfig.debug) {
      // Skip killing in debug mode
      return
    }

    await Sandbox.kill(this.sandboxId, { ...this.connectionConfig, ...opts })
  }

  /**
   * Get the URL to upload a file to the sandbox.
   * You have to send a POST request to this URL with the file as the field in the form data.
   * You can find the specification for this API at https://github.com/e2b-dev/E2B/blob/main/spec/envd/envd.yaml.
   *
   * @param path Path to the directory where the file will be uploaded, defaults to user's home directory
   * @returns URL to upload the file
   */
  uploadUrl(path?: string) {
    return this.fileUrl(path)
  }

  /**
   * Get the URL to download a file from the sandbox.
   *
   * @param path Path to the file
   * @returns URL to download the file
   */
  downloadUrl(path: string) {
    return this.fileUrl(path)
  }

  /**
   * Get the URL to a file in the sandbox.
   *
   * @param path Path to the file
   * @returns URL to the file
   */
  private fileUrl(path?: string) {
    const url = new URL('/files', this.envdApiUrl)
    url.searchParams.set('username', defaultUsername)
    if (path) {
      url.searchParams.set('path', path)
    }

    return url.toString()
  }
}
