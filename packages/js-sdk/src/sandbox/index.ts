import { createConnectTransport } from '@connectrpc/connect-web'

import { ConnectionOpts, ConnectionConfig } from '../connectionConfig'
import { Filesystem } from './filesystem'
import { Process } from './process'
import { EnvdApiClient } from '../envd/api'
import { ApiClient } from '../api'
import { Terminal } from './terminal'

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

export class Sandbox {
  protected static readonly defaultTemplate = 'base'

  readonly filesystem: Filesystem
  readonly process: Process
  readonly terminal: Terminal

  protected readonly envdPort = 49982

  private readonly connectionConfig: ConnectionConfig

  constructor(readonly sandboxID: string, opts?: Omit<SandboxOpts, 'timeoutMs' | 'metadata'>) {
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

  static async kill(
    sandboxID: string,
    opts?: ConnectionOpts,
  ): Promise<void> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    // TODO: Ensure the short id/long id works
    // TODO: Check if the errors are thrown properly

    await client.api.DELETE('/sandboxes/{sandboxID}', {
      params: {
        path: {
          sandboxID,
        },
      },
    })
  }

  static async list(opts?: ConnectionOpts): Promise<RunningSandbox[]> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.GET('/sandboxes')

    return res.data?.map((sandbox) => ({
      sandboxID: this.getSandboxID(sandbox),
      templateID: sandbox.templateID,
      ...(sandbox.alias && { name: sandbox.alias }),
      ...(sandbox.metadata && { metadata: sandbox.metadata }),
      startedAt: new Date(sandbox.startedAt),
    })) ?? []
  }

  protected static async createSandbox(
    template: string,
    opts?: ConnectionOpts & {
      metadata?: Record<string, string>,
      timeout?: number,
    }): Promise<string> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.POST('/sandboxes', {
      body: {
        templateID: template,
        metadata: opts?.metadata,
        timeout: opts?.timeout,
      },
    })

    return this.getSandboxID(res.data!)
  }

  protected static async setTimeout(
    sandboxID: string,
    timeoutMs: number,
    opts?: ConnectionOpts,
  ): Promise<void> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    // TODO: Ensure the short id/long id works

    await client.api.POST('/sandboxes/{sandboxID}/timeout', {
      params: {
        path: {
          sandboxID,
        },
      },
      body: {
        timeout: timeoutMs,
      },
    })
  }

  private static getSandboxID({ sandboxID, clientID }: { sandboxID: string, clientID: string }): string {
    return `${sandboxID}-${clientID}`
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
