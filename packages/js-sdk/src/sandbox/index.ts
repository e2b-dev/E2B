import { createConnectTransport } from '@connectrpc/connect-web'

import { ConnectionOpts, ConnectionConfig, defaultUsername } from '../connectionConfig'
import { Filesystem } from './filesystem'
import { Process } from './process'
import { Pty } from './pty'
import { SandboxApi } from './sandboxApi'

// @ts-ignore
Symbol.asyncDispose ??= Symbol('Symbol.asyncDispose')

export interface RunningSandbox {
  sandboxID: string
  templateID: string
  name?: string
  metadata?: Record<string, string>
  startedAt: Date
}

export interface SandboxOpts extends ConnectionOpts {
  metadata?: Record<string, string>
  timeoutMs?: number
}

export class Sandbox extends SandboxApi {
  protected static readonly defaultTemplate = 'base-v1'
  protected static readonly defaultSandboxTimeoutMs = 300_000

  readonly files: Filesystem
  readonly commands: Process
  readonly pty: Pty

  protected readonly envdPort = 49982

  private readonly connectionConfig: ConnectionConfig
  private readonly envdApiUrl: string

  constructor(readonly sandboxID: string, opts?: Omit<SandboxOpts, 'timeoutMs' | 'metadata'>) {
    super()

    this.connectionConfig = new ConnectionConfig(opts)
    this.envdApiUrl = `${this.connectionConfig.debug ? 'http' : 'https'}://${this.getHost(this.envdPort)}`

    const rpcTransport = createConnectTransport({ baseUrl: this.envdApiUrl, useBinaryFormat: true })

    this.files = new Filesystem(rpcTransport, this.envdApiUrl, this.connectionConfig)
    this.commands = new Process(rpcTransport, this.connectionConfig)
    this.pty = new Pty(rpcTransport, this.connectionConfig)
  }

  get uploadUrl() {
    const url = new URL('/files', this.envdApiUrl)
    url.searchParams.set('username', defaultUsername)

    return url.toString()
  }

  static async create<S extends typeof Sandbox>(this: S, opts?: SandboxOpts): Promise<InstanceType<S>>
  static async create<S extends typeof Sandbox>(this: S, template: string, opts?: SandboxOpts): Promise<InstanceType<S>>
  static async create<S extends typeof Sandbox>(this: S, templateOrOpts?: SandboxOpts | string, opts?: SandboxOpts): Promise<InstanceType<S>> {
    const { template, sandboxOpts } = typeof templateOrOpts === 'string'
      ? { template: templateOrOpts, sandboxOpts: opts }
      : { template: this.defaultTemplate, sandboxOpts: templateOrOpts }

    const config = new ConnectionConfig(sandboxOpts)

    const sandboxID = config.debug
      ? 'debug_sandbox_id'
      : await this.createSandbox(template, this.defaultSandboxTimeoutMs, sandboxOpts)

    return new this(sandboxID, sandboxOpts) as InstanceType<S>
  }

  static async connect<S extends typeof Sandbox>(this: S, sandboxID: string, opts?: Omit<SandboxOpts, 'metadata' | 'timeoutMs'>): Promise<InstanceType<S>> {
    return new this(sandboxID, opts) as InstanceType<S>
  }

  getHost(port: number) {
    if (this.connectionConfig.debug) {
      return `localhost:${port}`
    }

    return `${port}-${this.sandboxID}.${this.connectionConfig.domain}`
  }

  async setTimeout(timeoutMs: number, opts?: Pick<SandboxOpts, 'requestTimeoutMs'>) {
    await Sandbox.setTimeout(this.sandboxID, timeoutMs, { ...this.connectionConfig, ...opts })
  }

  async kill(opts?: Pick<SandboxOpts, 'requestTimeoutMs'>) {
    await Sandbox.kill(this.sandboxID, { ...this.connectionConfig, ...opts })
  }

  async [Symbol.asyncDispose]() {
    await this.kill()
  }
}
