import { SandboxApi } from './sandboxApi'
import { SandboxRpc } from './rpc'
import { Logger } from './logger'
import { SandboxFiles } from './sandboxFiles'
import { ConnectionOpts, ConnectionConfig } from '../connectionConfig'

export interface SandboxOpts extends ConnectionOpts {
  /**
   * A dictionary of strings that is stored alongside the running sandbox.
   * You can see this metadata when you list running sandboxes.
   */
  metadata?: { [key: string]: string }
  logger?: Logger
  timeout?: number
}

const SANDBOX_SERVER_PORT = 49982


export class Sandbox extends SandboxApi {
  protected static readonly defaultTemplate = 'base'

  private readonly connectionConfig: ConnectionConfig

  private readonly rpc: SandboxRpc
  private readonly files: SandboxFiles

  constructor(readonly sandboxID: string, opts: Omit<SandboxOpts, 'timeout' | 'metadata'> = {}) {
    super()

    this.connectionConfig = new ConnectionConfig(opts)

    const sandboxServerUrl = `${this.connectionConfig.debug ? 'http' : 'https'}://${this.getHostname(SANDBOX_SERVER_PORT)}`

    this.rpc = new SandboxRpc(sandboxServerUrl)
    this.files = new SandboxFiles(sandboxServerUrl)
  }

  get filesystem() {
    return this.rpc.filesystem
  }

  get process() {
    return this.rpc.process
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
