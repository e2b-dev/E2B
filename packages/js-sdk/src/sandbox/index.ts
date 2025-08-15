import { createConnectTransport } from '@connectrpc/connect-web'

import {
  ConnectionConfig,
  ConnectionOpts,
  DEFAULT_SANDBOX_TIMEOUT_MS,
  defaultUsername,
  Username,
} from '../connectionConfig'
import { EnvdApiClient, handleEnvdApiError } from '../envd/api'
import { createRpcLogger } from '../logs'
import { Commands, Pty } from './commands'
import { Filesystem } from './filesystem'
import {
  SandboxApi,
  SandboxOpts,
  SandboxConnectOpts,
  SandboxResumeOpts,
  SandboxMetricsOpts,
} from './sandboxApi'
import { getSignature } from './signature'
import { compareVersions } from 'compare-versions'
import { NotFoundError, SandboxError } from '../errors'
import { ApiClient, handleApiError } from '../api'

/**
 * Options for sandbox upload/download URL generation.
 */
export interface SandboxUrlOpts {
  /**
   * Use signature expiration for the URL.
   * Optional parameter to set the expiration time for the signature in seconds.
   */
  useSignatureExpiration?: number

  /**
   * User that will be used to access the file.
   */
  user?: Username
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
 * import { Sandbox } from 'e2b'
 *
 * const sandbox = await Sandbox.create()
 * ```
 */
export class Sandbox extends SandboxApi {
  protected static readonly defaultTemplate: string = 'base'
  protected static readonly defaultSandboxTimeoutMs = DEFAULT_SANDBOX_TIMEOUT_MS
  private static _beta?: StaticBeta<typeof this>

  /**
   * Module for interacting with the sandbox filesystem
   */
  readonly files: Filesystem
  /**
   * Module for running commands in the sandbox
   */
  readonly commands: Commands
  /**
   * Module for interacting with the sandbox pseudo-terminals
   */
  readonly pty: Pty

  /**
   * Unique identifier of the sandbox.
   */
  readonly sandboxId: string

  /**
   * Domain where the sandbox is hosted.
   */
  readonly sandboxDomain: string

  protected readonly envdPort = 49983

  protected readonly connectionConfig: ConnectionConfig
  private readonly envdApiUrl: string
  private readonly envdAccessToken?: string
  private readonly envdApi: EnvdApiClient
  private _beta?: InstanceBeta<this>

  /**
   * Use {@link Sandbox.create} to create a new Sandbox instead.
   *
   * @hidden
   * @hide
   * @internal
   * @access protected
   */
  constructor(
    opts: SandboxConnectOpts & {
      sandboxId: string
      sandboxDomain?: string
      envdVersion?: string
      envdAccessToken?: string
    }
  ) {
    super()

    this.connectionConfig = new ConnectionConfig(opts)

    this.sandboxId = opts.sandboxId
    this.sandboxDomain = opts.sandboxDomain ?? this.connectionConfig.domain

    this.envdAccessToken = opts.envdAccessToken
    this.envdApiUrl = `${
      this.connectionConfig.debug ? 'http' : 'https'
    }://${this.getHost(this.envdPort)}`

    const rpcTransport = createConnectTransport({
      baseUrl: this.envdApiUrl,
      useBinaryFormat: false,
      interceptors: opts?.logger ? [createRpcLogger(opts.logger)] : undefined,
      fetch: (url, options) => {
        // Patch fetch to always use redirect: "follow"
        // connect-web doesn't allow to configure redirect option - https://github.com/connectrpc/connect-es/pull/1082
        // connect-web package uses redirect: "error" which is not supported in edge runtimes
        // E2B endpoints should be safe to use with redirect: "follow" https://github.com/e2b-dev/E2B/issues/531#issuecomment-2779492867

        const headers = new Headers(this.connectionConfig.headers)
        new Headers(options?.headers).forEach((value, key) =>
          headers.append(key, value)
        )

        if (this.envdAccessToken) {
          headers.append('X-Access-Token', this.envdAccessToken)
        }

        options = {
          ...(options ?? {}),
          headers: headers,
          redirect: 'follow',
        }

        return fetch(url, options)
      },
    })

    this.envdApi = new EnvdApiClient(
      {
        apiUrl: this.envdApiUrl,
        logger: opts?.logger,
        accessToken: this.envdAccessToken,
        headers: this.envdAccessToken
          ? { 'X-Access-Token': this.envdAccessToken }
          : {},
      },
      {
        version: opts?.envdVersion,
      }
    )
    this.files = new Filesystem(
      rpcTransport,
      this.envdApi,
      this.connectionConfig
    )
    this.commands = new Commands(rpcTransport, this.connectionConfig)
    this.pty = new Pty(rpcTransport, this.connectionConfig)
  }

  /**
   * Module for beta features.
   */
  static get beta() {
    const Ctor = this.constructor as typeof Sandbox
    if (!Ctor._beta) {
      // create a new one
      const betaClass = makeBeta(this)
      return new betaClass() as unknown as StaticBeta<typeof this>
    }

    // return the existing one
    return Ctor._beta
  }

  /**
   * Module for beta features.
   */
  get beta(): InstanceBeta<this> {
    if (!this._beta) {
      // Bound the resume and pause methods to the instance
      const resumeBound = this.resume.bind(this) as (
        opts?: SandboxResumeOpts
      ) => Promise<this>

      const pauseBound = this.pause.bind(this) as (
        opts?: ConnectionOpts
      ) => Promise<boolean>

      this._beta = new InstanceBeta<this>(resumeBound, pauseBound)
    }

    // return the existing one
    return this._beta
  }

  /**
   * Create a new sandbox from the default `base` sandbox template.
   *
   * @param opts connection options.
   *
   * @returns sandbox instance for the new sandbox.
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

  /**
   * Create a new sandbox from the specified sandbox template.
   *
   * @param template sandbox template name or ID.
   * @param opts connection options.
   *
   * @returns sandbox instance for the new sandbox.
   *
   * @example
   * ```ts
   * const sandbox = await Sandbox.create('<template-name-or-id>')
   * ```
   * @constructs Sandbox
   */
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
    if (config.debug) {
      return new this({
        sandboxId: 'debug_sandbox_id',
        ...config,
      }) as InstanceType<S>
    }

    const sandbox = await this.createSandbox(
      template,
      sandboxOpts?.timeoutMs ?? this.defaultSandboxTimeoutMs,
      sandboxOpts
    )

    return new this({ ...sandbox, ...config }) as InstanceType<S>
  }

  /**
   * Connect to an existing sandbox.
   * With sandbox ID you can connect to the same sandbox from different places or environments (serverless functions, etc).
   *
   * @param sandboxId sandbox ID.
   * @param opts connection options.
   *
   * @returns sandbox instance for the existing sandbox.
   *
   * @example
   * ```ts
   * const sandbox = await Sandbox.create()
   * const sandboxId = sandbox.sandboxId
   *
   * // Connect to the same sandbox.
   * const sameSandbox = await Sandbox.connect(sandboxId)
   * ```
   */
  static async connect<S extends typeof Sandbox>(
    this: S,
    sandboxId: string,
    opts?: SandboxConnectOpts
  ): Promise<InstanceType<S>> {
    const info = await this.getFullInfo(sandboxId, opts)

    const config = new ConnectionConfig({
      ...opts,
      // We don't want to pass headers to the connection config as they would then be inherited by all requests,
      // which can be confusing.
      headers: undefined,
    })

    return new this({
      sandboxId,
      sandboxDomain: info.sandboxDomain,
      envdAccessToken: info.envdAccessToken,
      envdVersion: info.envdVersion,
      ...config,
    }) as InstanceType<S>
  }

  static async betaCreate<S extends typeof Sandbox>(
    this: S,
    templateOrOpts?: SandboxOpts | string,
    opts?: SandboxOpts
  ): Promise<InstanceType<S>> {
    const { template, sandboxOpts } =
      typeof templateOrOpts === 'string'
        ? { template: templateOrOpts, sandboxOpts: opts }
        : { template: this.defaultTemplate, sandboxOpts: templateOrOpts }

    const config = new ConnectionConfig(sandboxOpts)
    if (config.debug) {
      return new this({
        sandboxId: 'debug_sandbox_id',
        ...config,
      }) as InstanceType<S>
    }

    const sandbox = await this.createSandbox(
      template,
      sandboxOpts?.timeoutMs ?? this.defaultSandboxTimeoutMs,
      sandboxOpts
    )

    return new this({ ...sandbox, ...config }) as InstanceType<S>
  }

  /**
   * Get the host address for the specified sandbox port.
   * You can then use this address to connect to the sandbox port from outside the sandbox via HTTP or WebSocket.
   *
   * @param port number of the port in the sandbox.
   *
   * @returns host address of the sandbox port.
   *
   * @example
   * ```ts
   * const sandbox = await Sandbox.create()
   * // Start an HTTP server
   * await sandbox.commands.exec('python3 -m http.server 3000')
   * // Get the hostname of the HTTP server
   * const serverURL = sandbox.getHost(3000)
   * ```
   */
  getHost(port: number) {
    if (this.connectionConfig.debug) {
      return `localhost:${port}`
    }

    return `${port}-${this.sandboxId}.${this.sandboxDomain}`
  }

  /**
   * Check if the sandbox is running.
   *
   * @returns `true` if the sandbox is running, `false` otherwise.
   *
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
   * Set the timeout of the sandbox.
   * After the timeout expires the sandbox will be automatically killed.
   *
   * This method can extend or reduce the sandbox timeout set when creating the sandbox or from the last call to `.setTimeout`.
   * Maximum time a sandbox can be kept alive is 24 hours (86_400_000 milliseconds) for Pro users and 1 hour (3_600_000 milliseconds) for Hobby users.
   *
   * @param timeoutMs timeout in **milliseconds**.
   * @param opts connection options.
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
   * @param opts connection options.
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
   *
   * You have to send a POST request to this URL with the file as multipart/form-data.
   *
   * @param path path to the file in the sandbox.
   *
   * @param opts download url options.
   *
   * @returns URL for uploading file.
   */
  async uploadUrl(path?: string, opts?: SandboxUrlOpts) {
    opts = opts ?? {}

    const useSignature = !!this.envdAccessToken

    if (!useSignature && opts.useSignatureExpiration != undefined) {
      throw new Error(
        'Signature expiration can be used only when sandbox is created as secured.'
      )
    }

    const username = opts.user ?? defaultUsername
    const filePath = path ?? ''
    const fileUrl = this.fileUrl(filePath, username)

    if (useSignature) {
      const url = new URL(fileUrl)
      const sig = await getSignature({
        path: filePath,
        operation: 'write',
        user: username,
        expirationInSeconds: opts.useSignatureExpiration,
        envdAccessToken: this.envdAccessToken,
      })

      url.searchParams.set('signature', sig.signature)
      if (sig.expiration) {
        url.searchParams.set('signature_expiration', sig.expiration.toString())
      }

      return url.toString()
    }

    return fileUrl
  }

  /**
   * Get the URL to download a file from the sandbox.
   *
   * @param path path to the file in the sandbox.
   *
   * @param opts download url options.
   *
   * @returns URL for downloading file.
   */
  async downloadUrl(path: string, opts?: SandboxUrlOpts) {
    opts = opts ?? {}

    const useSignature = !!this.envdAccessToken

    if (!useSignature && opts.useSignatureExpiration != undefined) {
      throw new Error(
        'Signature expiration can be used only when sandbox is created as secured.'
      )
    }

    const username = opts.user ?? defaultUsername
    const fileUrl = this.fileUrl(path, username)

    if (useSignature) {
      const url = new URL(fileUrl)
      const sig = await getSignature({
        path,
        operation: 'read',
        user: username,
        expirationInSeconds: opts.useSignatureExpiration,
        envdAccessToken: this.envdAccessToken,
      })

      url.searchParams.set('signature', sig.signature)
      if (sig.expiration) {
        url.searchParams.set('signature_expiration', sig.expiration.toString())
      }

      return url.toString()
    }

    return fileUrl
  }

  /**
   * Get sandbox information like sandbox ID, template, metadata, started at/end at date.
   *
   * @param opts connection options.
   *
   * @returns information about the sandbox
   */
  async getInfo(opts?: Pick<SandboxOpts, 'requestTimeoutMs'>) {
    return await Sandbox.getInfo(this.sandboxId, {
      ...this.connectionConfig,
      ...opts,
    })
  }

  /**
   * Get the metrics of the sandbox.
   *
   * @param opts connection options.
   *
   * @returns  List of sandbox metrics containing CPU, memory and disk usage information.
   */
  async getMetrics(
    opts?: Pick<SandboxMetricsOpts, 'start' | 'end' | 'requestTimeoutMs'>
  ) {
    if (this.envdApi.version) {
      if (compareVersions(this.envdApi.version, '0.1.5') < 0) {
        throw new SandboxError(
          'You need to update the template to use the new SDK. ' +
            'You can do this by running `e2b template build` in the directory with the template.'
        )
      }

      if (compareVersions(this.envdApi.version, '0.2.4') < 0) {
        this.connectionConfig.logger?.warn?.(
          'Disk metrics are not supported in this version of the sandbox, please rebuild the template to get disk metrics.'
        )
      }
    }

    return await Sandbox.getMetrics(this.sandboxId, {
      ...this.connectionConfig,
      ...opts,
    })
  }

  protected async resume<T extends typeof Sandbox>(
    this: InstanceType<T>,
    opts?: SandboxResumeOpts
  ): Promise<InstanceType<T>> {
    const Ctor = this.constructor as T
    await Ctor.resumeSandbox(this.sandboxId, opts)

    const config = new ConnectionConfig({
      ...opts,
      // We don't want to pass headers to the connection config as they would then be inherited by all requests,
      // which can be confusing.
      headers: undefined,
    })

    return await Ctor.connect(this.sandboxId, config)
  }

  private async pause(opts?: ConnectionOpts): Promise<boolean> {
    return await Sandbox.pauseSandbox(this.sandboxId, opts)
  }

  private fileUrl(path?: string, username?: string) {
    const url = new URL('/files', this.envdApiUrl)

    url.searchParams.set('username', username ?? defaultUsername)
    if (path) {
      url.searchParams.set('path', path)
    }

    return url.toString()
  }
}

/**
 * Beta features for static Sandbox methods
 */
interface StaticBeta<I extends typeof Sandbox> {
  /**
   **
   * Create a new sandbox from the specified sandbox template.
   *
   * @param opts connection options.
   *
   * @returns sandbox instance for the new sandbox.
   *
   * @example
   * ```ts
   * const sandbox = await Sandbox.create('<template-name-or-id>')
   * ```
   * @constructs Sandbox
   */
  create(opts?: SandboxOpts): Promise<InstanceType<I>>
  /**
   * Create a new sandbox from the specified sandbox template.
   *
   * @param template sandbox template name or ID.
   * @param opts connection options.
   *
   * @returns sandbox instance for the new sandbox.
   *
   * @example
   * ```ts
   * const sandbox = await Sandbox.create('<template-name-or-id>')
   * ```
   * @constructs Sandbox
   */
  create(template: string, opts?: SandboxOpts): Promise<InstanceType<I>>

  /**
   * Resume the sandbox.
   *
   * The **default sandbox timeout of 300 seconds** ({@link Sandbox.defaultSandboxTimeoutMs}) will be used for the resumed sandbox.
   * If you pass a custom timeout in the `opts` parameter via {@link SandboxOpts.timeoutMs} property, it will be used instead.
   *
   * @param sandboxId sandbox ID.
   * @param opts connection options.
   *
   * @returns a running sandbox instance.
   */
  resume(sandboxId: string, opts?: SandboxResumeOpts): Promise<InstanceType<I>>

  /**
   * Pause a sandbox by its ID.
   *
   * @param sandboxId sandbox ID.
   * @param opts connection options.
   *
   * @returns sandbox ID that can be used to resume the sandbox.
   */
  pause(sandboxId: string, opts?: ConnectionOpts): Promise<boolean>
}

/**
 * Beta features for Sandbox instances
 */
class InstanceBeta<I extends Sandbox> {
  constructor(
    private resumeSandbox: (opts?: SandboxResumeOpts) => Promise<I>,
    private pauseSandbox: (opts?: ConnectionOpts) => Promise<boolean>
  ) {}

  /**
   * Resume the sandbox.
   *
   * The **default sandbox timeout of 300 seconds** ({@link Sandbox.defaultSandboxTimeoutMs}) will be used for the resumed sandbox.
   * If you pass a custom timeout in the `opts` parameter via {@link SandboxOpts.timeoutMs} property, it will be used instead.
   *
   * @param opts connection options.
   *
   * @returns a running sandbox instance.
   */
  async resume(opts?: SandboxResumeOpts) {
    return await this.resumeSandbox(opts)
  }

  /**
   * Pause a sandbox by its ID.
   *
   * @param opts connection options.
   *
   * @returns sandbox ID that can be used to resume the sandbox.
   */
  async pause(opts?: ConnectionOpts) {
    return await this.pauseSandbox(opts)
  }
}
function makeBeta<S extends typeof Sandbox>(Ctor: S) {
  return class {
    static async create(
      templateOrOpts?: SandboxOpts | string,
      opts?: SandboxOpts
    ): Promise<InstanceType<S>> {
      if (typeof templateOrOpts === 'string') {
        return await Ctor.betaCreate(templateOrOpts, opts)
      }
      return await Ctor.betaCreate(templateOrOpts)
    }

    /**
     * Resume the sandbox.
     *
     * The **default sandbox timeout of 300 seconds** ({@link Sandbox.defaultSandboxTimeoutMs}) will be used for the resumed sandbox.
     * If you pass a custom timeout in the `opts` parameter via {@link SandboxOpts.timeoutMs} property, it will be used instead.
     *
     * @param sandboxId sandbox ID.
     * @param opts connection options.
     *
     * @returns a running sandbox instance.
     */
    async resume(
      sandboxId: string,
      opts?: SandboxResumeOpts
    ): Promise<InstanceType<S>> {
      const timeoutMs = opts?.timeoutMs ?? DEFAULT_SANDBOX_TIMEOUT_MS

      const config = new ConnectionConfig(opts)
      const client = new ApiClient(config)

      const res = await client.api.POST('/sandboxes/{sandboxID}/resume', {
        params: {
          path: {
            sandboxID: sandboxId,
          },
        },
        body: {
          autoPause: false,
          timeout: Math.ceil(timeoutMs / 1000),
        },
        signal: config.getSignal(opts?.requestTimeoutMs),
      })

      if (res.error?.code === 404) {
        throw new NotFoundError(`Paused sandbox ${sandboxId} not found`)
      }

      if (res.error?.code === 409) {
        // Sandbox is already running
      }

      const err = handleApiError(res)
      if (err) {
        throw err
      }

      return await Ctor.connect(sandboxId, opts)
    }

    /**
     * Pause a sandbox by its ID.
     *
     * @param sandboxId sandbox ID.
     * @param opts connection options.
     *
     * @returns sandbox ID that can be used to resume the sandbox.
     */
    async pause(sandboxId: string, opts?: ConnectionOpts): Promise<boolean> {
      const config = new ConnectionConfig(opts)
      const client = new ApiClient(config)

      const res = await client.api.POST('/sandboxes/{sandboxID}/pause', {
        params: {
          path: {
            sandboxID: sandboxId,
          },
        },
        signal: config.getSignal(opts?.requestTimeoutMs),
      })

      if (res.error?.code === 404) {
        throw new NotFoundError(`Sandbox ${sandboxId} not found`)
      }

      if (res.error?.code === 409) {
        // Sandbox is already paused
        return false
      }

      const err = handleApiError(res)
      if (err) {
        throw err
      }

      return true
    }
  }
}
