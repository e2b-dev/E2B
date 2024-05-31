import { APIOpts } from '../api'
import { RPC_PORT, DEBUG, DOMAIN } from '../constants'
import { getApiKey } from '../utils/apiKey'
import { SandboxApi } from './sandboxApi'
import { SandboxRpc } from './sandboxRpc'

export interface EnvVars {
  [key: string]: string
}

export interface Logger {
  debug?: (message: string, ...args: unknown[]) => void
  info?: (message: string, ...args: unknown[]) => void
  warn?: (message: string, ...args: unknown[]) => void
  error?: (message: string, ...args: unknown[]) => void
}

export type SandboxMetadata = {
  [key: string]: string
}

export interface SandboxOpts extends APIOpts {
  /**
   * Sandbox Template ID or name.
   */
  template?: string
  apiKey?: string
  /**
   * Domain to use for the API requests. If not provided, the `E2B_DOMAIN` environment variable will be used.
   */
  domain?: string
  cwd?: string
  envVars?: EnvVars
  /**
   * A dictionary of strings that is stored alongside the running sandbox.
   * You can see this metadata when you list running sandboxes.
   */
  metadata?: SandboxMetadata
  logger?: Logger
  timeout?: number
}

export class Sandbox extends SandboxApi {
  private readonly rpc: SandboxRpc

  constructor(private readonly id: string, private readonly opts: Omit<SandboxOpts, 'timeout' | 'metadata' | 'template' | ''>) {
    super()

    const hostname = this.getHostname(RPC_PORT)
    const rpcUrl = `${this.debug ? 'http' : 'https'}://${hostname}`

    this.rpc = new SandboxRpc(rpcUrl)
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

  private get envVars() {
    // return this.opts?.envVars ?? {}
  }

  private get cwd() {
    // return this.opts?.cwd ?? process.cwd()
  }

  /**
   * Creates a new Sandbox from the default `base` sandbox template.
   * @returns New Sandbox
   *
   * @constructs Sandbox
   */
  static async spawn<S extends typeof Sandbox>(this: S): Promise<InstanceType<S>>
  /**
   * Creates a new Sandbox from the template with the specified ID.
   * @param template Sandbox template ID or name
   * @returns New Sandbox
   */
  static async spawn<S extends typeof Sandbox>(this: S, template: string): Promise<InstanceType<S>>
  /**
   * Creates a new Sandbox from the specified options.
   * @param opts Sandbox options
   * @returns New Sandbox
   */
  static async spawn<S extends typeof Sandbox>(this: S, opts: SandboxOpts): Promise<InstanceType<S>>
  static async spawn(optsOrTemplate?: string | SandboxOpts) {
    const opts: SandboxOpts = typeof optsOrTemplate === 'string'
      ? { template: optsOrTemplate }
      : optsOrTemplate

    const sandboxID = await this.spawn(opts.template, opts)

    return new this(sandboxID)
  }

  /**
 * Reconnects to an existing Sandbox.
 * @param sandboxID Sandbox ID
 * @returns Existing Sandbox
 */
  static async connect<S extends typeof Sandbox>(this: S, sandboxID: string): Promise<InstanceType<S>>
  /**
   * Reconnects to an existing Sandbox.
   * @param opts Sandbox options
   * @returns Existing Sandbox
   */
  static async connect<S extends typeof Sandbox>(this: S, opts: Omit<SandboxOpts, 'id' | 'template'> & { sandboxID: string }): Promise<InstanceType<S>>
  static async connect<S extends typeof Sandbox>(this: S, sandboxIDorOpts: string | Omit<SandboxOpts, 'id' | 'template'> & { sandboxID: string }): Promise<InstanceType<S>> {
    let id: string
    let opts: SandboxOpts
    if (typeof sandboxIDorOpts === 'string') {
      id = sandboxIDorOpts
      opts = {}
    } else {
      id = sandboxIDorOpts.sandboxID
      opts = sandboxIDorOpts
    }

    return new this(sandboxID) as InstanceType<S>
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

    const hostname = `${this.id}.${this.domain}`
    if (port) {
      return `${port}-${hostname}`
    }

    return hostname
  }

  async setTimeout(timeout: number) {
    await SandboxApi.setTimeout(this.id, timeout, {
      apiKey: this.apiKey,
      domain: this.domain,
      debug: this.debug,
    })
  }

  async kill() {
    await SandboxApi.kill(this.id, {
      apiKey: this.apiKey,
      domain: this.domain,
      debug: this.debug,
    })
  }
}
