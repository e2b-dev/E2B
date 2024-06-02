import { createConnectTransport } from '@connectrpc/connect-web'

import { ConnectionOpts, ConnectionConfig } from '../connectionConfig'
import { Filesystem } from './filesystem'
import { Process } from './process'
import { EnvdApiClient } from '../envd/api'
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

export class Sandbox extends SandboxApi {
  protected static readonly defaultTemplate = 'base'

  readonly filesystem: Filesystem
  readonly process: Process
  readonly terminal: Terminal

  protected readonly envdPort = 49982

  private readonly connectionConfig: ConnectionConfig

  constructor(readonly sandboxID: string, opts?: Omit<SandboxOpts, 'timeoutMs' | 'metadata'>) {
    super()

    this.connectionConfig = new ConnectionConfig(opts)
    const sandboxServerUrl = `${this.connectionConfig.debug ? 'http' : 'https'}://${this.getHost(this.envdPort)}`

    const rpcTransport = createConnectTransport({ baseUrl: sandboxServerUrl })
    const envdApiClient = new EnvdApiClient({ apiUrl: sandboxServerUrl })

    this.filesystem = new Filesystem(rpcTransport, envdApiClient)
    this.process = new Process(rpcTransport)
    this.terminal = new Terminal(rpcTransport)
  }

  get uploadUrl() {
    const host = this.getHost(this.envdPort)
    // TODO: Ensure all user, etc setting are applied here
    // TODO: Ensure envd handles this well
    return `${this.connectionConfig.debug ? 'http' : 'https'}://${host}/upload`
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

  async setTimeout(timeout: number) {
    await Sandbox.setTimeout(this.sandboxID, timeout, this.connectionConfig)
  }

  async kill() {
    await Sandbox.kill(this.sandboxID, this.connectionConfig)
  }
}
