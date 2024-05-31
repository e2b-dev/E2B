import { APIOpts } from '../api'
import { RPC_PORT, DEBUG, DOMAIN } from '../constants'
import { getApiKey } from '../utils/apiKey'
import { SandboxApi } from './sandboxApi'
import { SandboxRpc } from './rpc'
import { Logger } from './logger'
import { SandboxMetadata } from './metadata'

export interface SandboxOpts extends APIOpts {
  apiKey?: string
  /**
   * Domain to use for the API requests. If not provided, the `E2B_DOMAIN` environment variable will be used.
   */
  domain?: string
  /**
   * A dictionary of strings that is stored alongside the running sandbox.
   * You can see this metadata when you list running sandboxes.
   */
  metadata?: SandboxMetadata
  logger?: Logger
  timeout?: number
}

export class Sandbox extends SandboxApi {
  protected static readonly defaultTemplate = 'base'

  private readonly rpc: SandboxRpc

  constructor(readonly sandboxID: string, private readonly opts: Omit<SandboxOpts, 'timeout' | 'metadata' | 'template' | ''>) {
    super()

    const rpcUrl = `${this.debug ? 'http' : 'https'}://${this.getHostname(RPC_PORT)}`

    this.rpc = new SandboxRpc(rpcUrl)
  }

  get filesystem() {
    return this.rpc.filesystem
  }

  get process() {
    return this.rpc.process
  }

  private get debug() {
    return this.opts?.debug ?? DEBUG
  }

  private get domain() {
    return this.opts?.domain ?? DOMAIN
  }

  private get apiKey() {
    return getApiKey(this.opts?.apiKey)
  }

  /**
   * Creates a new Sandbox from the specified options.
   */
  static async spawn<S extends typeof Sandbox>(this: S, template = this.defaultTemplate, opts: SandboxOpts = {}): Promise<InstanceType<S>> {
    const sandboxID = await this.createSandbox(template, opts)

    return new this(sandboxID, opts) as InstanceType<S>
  }

  /**
   * Connects to an existing Sandbox.
   */
  static async connect<S extends typeof Sandbox>(this: S, sandboxID: string, opts: Omit<SandboxOpts, 'id' | 'template'> = {}): Promise<InstanceType<S>> {
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
    if (this.debug) {
      if (port) {
        return `localhost:${port}`
      }

      return 'localhost'
    }

    const hostname = `${this.sandboxID}.${this.domain}`
    if (port) {
      return `${port}-${hostname}`
    }

    return hostname
  }

  async setTimeout(timeout: number) {
    await SandboxApi.setTimeout(this.sandboxID, timeout, {
      apiKey: this.apiKey,
      domain: this.domain,
      debug: this.debug,
    })
  }

  async kill() {
    await SandboxApi.kill(this.sandboxID, {
      apiKey: this.apiKey,
      domain: this.domain,
      debug: this.debug,
    })
  }
}
