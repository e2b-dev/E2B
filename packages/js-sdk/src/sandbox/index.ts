import { createConnectTransport } from '@connectrpc/connect-web'

import {
  ConnectionConfig,
  ConnectionOpts,
  defaultUsername,
} from '../connectionConfig'
import { EnvdApiClient, handleEnvdApiError } from '../envd/api'
import { createRpcLogger } from '../logs'
import { Commands, Pty } from './commands'
import { Filesystem } from './filesystem'
import { SandboxApi } from './sandboxApi'
import crypto from 'crypto'

/**
 * Options for creating a new Sandbox.
 */
export interface SandboxOpts extends ConnectionOpts {
  /**
   * Custom metadata for the sandbox.
   *
   * @default {}
   */
  metadata?: Record<string, string>

  /**
   * Custom environment variables for the sandbox.
   *
   * Used when executing commands and code in the sandbox.
   * Can be overridden with the `envs` argument when executing commands or code.
   *
   * @default {}
   */
  envs?: Record<string, string>

  /**
   * Timeout for the sandbox in **milliseconds**.
   * Maximum time a sandbox can be kept alive is 24 hours (86_400_000 milliseconds) for Pro users and 1 hour (3_600_000 milliseconds) for Hobby users.
   *
   * @default 300_000 // 5 minutes
   */
  timeoutMs?: number

  /**
   * Secure all traffic coming to the sandbox controller with auth token
   *
   * @default false
   */
  secure?: boolean
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
  protected static readonly defaultSandboxTimeoutMs = 300_000

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

  protected readonly envdPort = 49983

  protected readonly connectionConfig: ConnectionConfig
  private readonly envdApiUrl: string
  private readonly envdAccessToken?: string
  private readonly envdApi: EnvdApiClient

  /**
   * Use {@link Sandbox.create} to create a new Sandbox instead.
   *
   * @hidden
   * @hide
   * @internal
   * @access protected
   */
  constructor(
    opts: Omit<SandboxOpts, 'timeoutMs' | 'envs' | 'metadata'> & {
      sandboxId: string
      envdVersion?: string
      envdAccessToken?: string
    }
  ) {
    super()

    this.sandboxId = opts.sandboxId
    this.connectionConfig = new ConnectionConfig(opts)

    this.envdAccessToken = opts.envdAccessToken
    this.envdApiUrl = `${this.connectionConfig.debug ? 'http' : 'https'}://${this.getHost(this.envdPort)}`

    const rpcTransport = createConnectTransport({
      baseUrl: this.envdApiUrl,
      useBinaryFormat: false,
      interceptors: opts?.logger ? [createRpcLogger(opts.logger)] : undefined,
      fetch: (url, options) => {
        // Patch fetch to always use redirect: "follow"
        // connect-web doesn't allow to configure redirect option - https://github.com/connectrpc/connect-es/pull/1082
        // connect-web package uses redirect: "error" which is not supported in edge runtimes
        // E2B endpoints should be safe to use with redirect: "follow" https://github.com/e2b-dev/E2B/issues/531#issuecomment-2779492867

        const headers = new Headers(options?.headers)
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
        headers: this.envdAccessToken ? { 'X-Access-Token': this.envdAccessToken } : { },
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
    } else {
      const sandbox = await this.createSandbox(
        template,
        sandboxOpts?.timeoutMs ?? this.defaultSandboxTimeoutMs,
        sandboxOpts
      )
      return new this({ ...sandbox, ...config }) as InstanceType<S>
    }
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
    opts?: Omit<SandboxOpts, 'metadata' | 'envs' | 'timeoutMs'>
  ): Promise<InstanceType<S>> {
    const config = new ConnectionConfig(opts)
    //const info = await this.getInfo(sandboxId, opts)

    return new this(
      //  { sandboxId, envdAccessToken: info.envdAccessToken, envdVersion: info.envdVersion, ...config }
        { sandboxId, ...config }
    ) as InstanceType<S>
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

    return `${port}-${this.sandboxId}.${this.connectionConfig.domain}`
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
   * @param path the directory where to upload the file, defaults to user's home directory.
   *
   * @param useSignature URL will be signed with the access token, this can be used for uploading files to the sandbox from a different environment (e.g. browser).
   *
   * @param signatureExpirationInSeconds URL will be signed with the access token, this can be used for uploading files to the sandbox from a different environment (e.g. browser).
   *
   * @returns URL for uploading file.
   */
  uploadUrl(path?: string, useSignature?: boolean, signatureExpirationInSeconds?: number) {
    if (!this.envdAccessToken && (useSignature != undefined || signatureExpirationInSeconds != undefined)) {
      throw new Error('Signature can be used only when sandbox is spawned with secure option.')
    }

    if (useSignature == undefined && signatureExpirationInSeconds != undefined) {
      throw new Error('Signature expiration can be used only when signature is set to true.')
    }

   const fileUrl = this.fileUrl(path, defaultUsername)

    if (useSignature) {
      const url = new URL(fileUrl)
      const sig = this.getSignature(path ?? '', 'write', defaultUsername, signatureExpirationInSeconds)

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
   * @param path path to the file to download.
   *
   * @param useSignature URL will be signed with the access token, this can be used for uploading files to the sandbox from a different environment (e.g. browser).
   *
   * @param signatureExpirationInSeconds URL will be signed with the access token, this can be used for uploading files to the sandbox from a different environment (e.g. browser).
   *
   * @returns URL for downloading file.
   */
  downloadUrl(path: string, useSignature?: boolean, signatureExpirationInSeconds?: number) {
    if (!this.envdAccessToken && (useSignature != undefined || signatureExpirationInSeconds != undefined)) {
      throw new Error('Signature can be used only when sandbox is spawned with secure option.')
    }

    if (useSignature == undefined && signatureExpirationInSeconds != undefined) {
      throw new Error('Signature expiration can be used only when signature is set to true.')
    }

    const fileUrl = this.fileUrl(path, defaultUsername)

    if (useSignature) {
      const url = new URL(fileUrl)
      const sig = this.getSignature(path, 'read', defaultUsername, signatureExpirationInSeconds)
      url.searchParams.set('signature', sig.signature)
      if (sig.expiration) {
        url.searchParams.set('signature_expiration', sig.expiration.toString())
      }

      return url.toString()
    }

    return fileUrl
  }

  private fileUrl(path?: string, username?:  string) {
    const url = new URL('/files', this.envdApiUrl)
    url.searchParams.set('username', username ?? defaultUsername)
    if (path) {
      url.searchParams.set('path', path)
    }

    return url.toString()
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

  private getSignature(filePath: string, fileOperation: 'read' | 'write', user: string, expirationInSeconds?: number): { signature: string; expiration: number | null } {
    if (!this.envdAccessToken) {
      throw new Error('Access token is not set and signature cannot be generated!')
    }

    // expiration is unix timestamp
    const signatureExpiration = expirationInSeconds ? Math.floor(Date.now() / 1000) + expirationInSeconds : null
    let signatureRaw: string

    if (signatureExpiration === undefined || signatureExpiration === null) {
      signatureRaw = `${filePath}:${fileOperation}:${user}:${this.envdAccessToken}`
    } else {
      signatureRaw = `${filePath}:${fileOperation}:${user}:${this.envdAccessToken}:${signatureExpiration.toString()}`
    }

    const buff = Buffer.from(signatureRaw, 'utf8')
    const hash = crypto.createHash('sha256').update(buff).digest()
    const signature =  'v1_' + hash.toString('base64').replace(/=+$/, '')

    return {
        signature: signature,
        expiration: signatureExpiration
    }
  }
}
