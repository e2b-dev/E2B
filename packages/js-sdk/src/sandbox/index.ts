import { createConnectTransport } from '@connectrpc/connect-web'

import { ConnectionOpts, ConnectionConfig, defaultUsername } from '../connectionConfig'
import { createRpcLogger } from '../logs'
import { Filesystem } from './filesystem'
import { Process } from './process'
import { Pty } from './pty'
import { SandboxApi } from './sandboxApi'
import { EnvdApiClient, handleEnvdApiError } from '../envd/api'

export interface SandboxOpts extends ConnectionOpts {
  metadata?: Record<string, string>
  envs?: Record<string, string>
  timeoutMs?: number
}

export class Sandbox extends SandboxApi {
  protected static readonly defaultTemplate: string = 'base'
  protected static readonly defaultSandboxTimeoutMs = 300_000

  readonly files: Filesystem
  readonly commands: Process
  readonly pty: Pty

  readonly sandboxId: string

  protected readonly envdPort = 49983

  protected readonly connectionConfig: ConnectionConfig
  private readonly envdApiUrl: string
  private readonly envdApi: EnvdApiClient

  constructor(opts: Omit<SandboxOpts, 'timeoutMs' | 'envs' | 'metadata'> & { sandboxId: string }) {
    super()

    this.sandboxId = opts.sandboxId
    this.connectionConfig = new ConnectionConfig(opts)
    this.envdApiUrl = `${this.connectionConfig.debug ? 'http' : 'https'}://${this.getHost(this.envdPort)}`

    const rpcTransport = createConnectTransport({
      baseUrl: this.envdApiUrl,
      useBinaryFormat: true,
      interceptors: opts?.logger ? [createRpcLogger(opts.logger)] : undefined,
    })

    this.envdApi = new EnvdApiClient({ apiUrl: this.envdApiUrl, logger: opts?.logger })
    this.files = new Filesystem(rpcTransport, this.envdApi, this.connectionConfig)
    this.commands = new Process(rpcTransport, this.connectionConfig)
    this.pty = new Pty(rpcTransport, this.connectionConfig)
  }

  static async create<S extends typeof Sandbox>(this: S, opts?: SandboxOpts): Promise<InstanceType<S>>
  static async create<S extends typeof Sandbox>(this: S, template: string, opts?: SandboxOpts): Promise<InstanceType<S>>
  static async create<S extends typeof Sandbox>(this: S, templateOrOpts?: SandboxOpts | string, opts?: SandboxOpts): Promise<InstanceType<S>> {
    const { template, sandboxOpts } = typeof templateOrOpts === 'string'
      ? { template: templateOrOpts, sandboxOpts: opts }
      : { template: this.defaultTemplate, sandboxOpts: templateOrOpts }

    const config = new ConnectionConfig(sandboxOpts)

    const sandboxId = config.debug
      ? 'debug_sandbox_id'
      : await this.createSandbox(template, sandboxOpts?.timeoutMs ?? this.defaultSandboxTimeoutMs, sandboxOpts)

    const sbx = new this({ sandboxId, ...config }) as InstanceType<S>
    return sbx
  }

  static async connect<S extends typeof Sandbox>(this: S, sandboxId: string, opts?: Omit<SandboxOpts, 'metadata' | 'envs' | 'timeoutMs'>): Promise<InstanceType<S>> {
    const config = new ConnectionConfig(opts)

    const sbx = new this({ sandboxId, ...config }) as InstanceType<S>
    return sbx
  }

  getHost(port: number) {
    if (this.connectionConfig.debug) {
      return `localhost:${port}`
    }

    return `${port}-${this.sandboxId}.${this.connectionConfig.domain}`
  }

  async isRunning(opts?: Pick<ConnectionOpts, 'requestTimeoutMs'>): Promise<boolean> {
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

  async setTimeout(timeoutMs: number, opts?: Pick<SandboxOpts, 'requestTimeoutMs'>) {
    if (this.connectionConfig.debug) {
      // Skip timeout in debug mode
      return
    }

    await Sandbox.setTimeout(this.sandboxId, timeoutMs, { ...this.connectionConfig, ...opts })
  }

  async kill(opts?: Pick<SandboxOpts, 'requestTimeoutMs'>) {
    if (this.connectionConfig.debug) {
      // Skip killing in debug mode
      return
    }

    await Sandbox.kill(this.sandboxId, { ...this.connectionConfig, ...opts })
  }

  uploadUrl(path?: string) {
    return this.fileUrl(path)
  }

  downloadUrl(path: string) {
    return this.fileUrl(path)
  }

  private fileUrl(path?: string) {
    const url = new URL('/files', this.envdApiUrl)
    url.searchParams.set('username', defaultUsername)
    if (path) {
      url.searchParams.set('path', path)
    }

    return url.toString()
  }
}
