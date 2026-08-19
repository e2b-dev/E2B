import { ConnectionOpts } from './connectionConfig'
import { Sandbox } from './sandbox'
import { Secret } from './secret'
import { Volume } from './volume'

/**
 * E2B client with an explicitly bound connection configuration.
 *
 * The resource classes exposed by the client ({@link E2B.Sandbox},
 * {@link E2B.Volume}) behave exactly like the top-level `Sandbox` / `Volume`
 * exports, except the options passed to the client are used as the defaults
 * instead of the environment variables. Per-call options still take precedence
 * over the client's options.
 *
 * Multiple clients are fully isolated from each other and from the top-level
 * env-configured exports.
 *
 * @example
 * ```ts
 * import { E2B } from 'e2b'
 *
 * const client = new E2B({ apiKey: 'e2b_...', domain: 'e2b.dev' })
 *
 * const sandbox = await client.Sandbox.create()
 * const volumes = await client.Volume.list()
 * ```
 */
export class E2B {
  /**
   * `Sandbox` class bound to this client's connection configuration.
   */
  readonly Sandbox: typeof Sandbox

  /**
   * `Volume` class bound to this client's connection configuration.
   */
  readonly Volume: typeof Volume

  /**
   * `Secret` class. Secrets are resolved inside the sandbox, so there is no
   * connection configuration to bind — this is the top-level `Secret` class.
   */
  readonly Secret: typeof Secret = Secret

  /**
   * Create a new client with the connection options bound to it.
   *
   * @param opts connection options used as the defaults for every call made
   *   through this client's resource classes.
   */
  constructor(opts?: ConnectionOpts) {
    // Options are copied so later mutations of the caller's object cannot
    // change the bound configuration.
    const boundOpts: ConnectionOpts = { ...(opts ?? {}) }

    this.Sandbox = class extends Sandbox {
      protected static override readonly boundOpts = boundOpts
    }

    this.Volume = class extends Volume {
      protected static override readonly boundOpts = boundOpts
    }
  }
}
