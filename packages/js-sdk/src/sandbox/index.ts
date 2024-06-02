import { createConnectTransport } from '@connectrpc/connect-web'

import { ConnectionOpts, ConnectionConfig } from '../connectionConfig'
import { Filesystem } from './filesystem'
import { Process } from './process'
import { Terminal } from './terminal'
import { SandboxApi } from './sandboxApi'

export interface Logger {
  debug?: (...args: unknown[]) => void
  info?: (...args: unknown[]) => void
  warn?: (...args: unknown[]) => void
  error?: (...args: unknown[]) => void
}

export interface RunningSandbox {
  sandboxID: string
  templateID: string
  name?: string
  metadata?: Record<string, string>
  startedAt: Date
}

export interface SandboxOpts extends ConnectionOpts {
  metadata?: Record<string, string>
  logger?: Logger
  timeoutMs?: number
}

// TODO: Pass loggers and add logging (interceptors?)
export class Sandbox extends SandboxApi {
  protected static readonly defaultTemplate = 'base-v1'

  readonly files: Filesystem
  readonly process: Process
  readonly terminal: Terminal

  protected readonly envdPort = 49982

  private readonly connectionConfig: ConnectionConfig
  private readonly envdApiUrl: string

  constructor(readonly sandboxID: string, opts?: Omit<SandboxOpts, 'timeoutMs' | 'metadata'>) {
    super()

    this.connectionConfig = new ConnectionConfig(opts)
    this.envdApiUrl = `${this.connectionConfig.debug ? 'http' : 'https'}://${this.getHost(this.envdPort)}`

    const rpcTransport = createConnectTransport({ baseUrl: this.envdApiUrl })

    this.files = new Filesystem(rpcTransport, this.envdApiUrl, this.connectionConfig)
    this.process = new Process(rpcTransport, this.connectionConfig)
    this.terminal = new Terminal(rpcTransport, this.connectionConfig)
  }

  get uploadUrl() {
    // TODO: Ensure envd handles this well
    // TODO: Ensure all user, etc setting are applied here and are escaped

    const url = new URL('/files', this.envdApiUrl)
    url.searchParams.set('user', 'user')
    url.searchParams.set('mode', '0644')

    return url.toString()
  }

  static async spawn<S extends typeof Sandbox>(this: S, template = this.defaultTemplate, opts?: SandboxOpts): Promise<InstanceType<S>> {
    const sandboxID = await this.createSandbox(template, opts)

    return new this(sandboxID, opts) as InstanceType<S>
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

  async setTimeout(timeout: number, opts?: Pick<SandboxOpts, 'requestTimeoutMs'>) {
    await Sandbox.setTimeout(this.sandboxID, timeout, { ...this.connectionConfig, ...opts })
  }

  async kill(opts?: Pick<SandboxOpts, 'requestTimeoutMs'>) {
    await Sandbox.kill(this.sandboxID, { ...this.connectionConfig, ...opts })
  }
}
