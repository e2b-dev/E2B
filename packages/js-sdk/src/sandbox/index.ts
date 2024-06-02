import { SandboxApi } from './sandboxApi'
import { Logger } from './logger'
import { SandboxFiles } from './sandboxFiles'
import { ConnectionOpts, ConnectionConfig } from '../connectionConfig'
import { createConnectTransport } from '@connectrpc/connect-web'
import { Filesystem } from './filesystem'
import { Process } from './process'

export interface SandboxOpts extends ConnectionOpts {
  /**
   * A dictionary of strings that is stored alongside the running sandbox.
   * You can see this metadata when you list running sandboxes.
   */
  metadata?: Record<string, string>
  logger?: Logger
  timeout?: number
}

const SANDBOX_SERVER_PORT = 49982


export class Sandbox extends SandboxApi {
  protected static readonly defaultTemplate = 'base'

  readonly filesystem: Filesystem
  readonly process: Process

  private readonly connectionConfig: ConnectionConfig
  private readonly files: SandboxFiles

  constructor(readonly sandboxID: string, opts: Omit<SandboxOpts, 'timeout' | 'metadata'> = {}) {
    super()

    this.connectionConfig = new ConnectionConfig(opts)

    const sandboxServerUrl = `${this.connectionConfig.debug ? 'http' : 'https'}://${this.getHostname(SANDBOX_SERVER_PORT)}`

    this.files = new SandboxFiles(sandboxServerUrl)

    const rpcTransport = createConnectTransport({ baseUrl: sandboxServerUrl })
    this.filesystem = new Filesystem(rpcTransport)
    this.process = new Process(rpcTransport)
  }

  /**
   * Creates a new Sandbox from the specified options.
   */
  static async spawn<S extends typeof Sandbox>(this: S, template = this.defaultTemplate, opts?: SandboxOpts): Promise<InstanceType<S>> {
    const sandboxID = await this.createSandbox(template, opts)

    return new this(sandboxID, opts) as InstanceType<S>
  }

  /**
   * Connects to an existing Sandbox.
   */
  static async connect<S extends typeof Sandbox>(this: S, sandboxID: string, opts?: Omit<SandboxOpts, 'metadata' | 'timeout'>): Promise<InstanceType<S>> {
    return new this(sandboxID, opts) as InstanceType<S>
  }

  /**
    * Get the hostname for the sandbox or for the specified sandbox's port.
    *
    * `getHostname` method requires `this` context - you may need to bind it.
    *
    * @param port Specify if you want to connect to a specific port of the sandbox
    * @returns Hostname of the sandbox or sandbox's port
    */
  getHostname(port: number) {
    if (this.connectionConfig.debug) {
      return `localhost:${port}`
    }

    return `${port}-${this.sandboxID}.${this.connectionConfig.domain}`
  }

  async setTimeout(timeout: number) {
    await SandboxApi.setTimeout(this.sandboxID, timeout, this.connectionConfig)
  }

  async kill() {
    await SandboxApi.kill(this.sandboxID, this.connectionConfig)
  }
}
