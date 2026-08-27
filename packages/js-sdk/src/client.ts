import { E2BClientOpts } from './connectionConfig'
import { Sandbox } from './sandbox'
import { Secret } from './secret'
import { Template } from './template'
import { Volume } from './volume'

export type { E2BClientOpts } from './connectionConfig'

/**
 * E2B client with an explicitly bound connection configuration.
 *
 * The resources exposed by the client ({@link E2B.Sandbox},
 * {@link E2B.Volume}, {@link E2B.Template}, {@link E2B.Secret}) behave exactly
 * like the top-level `Sandbox` / `Volume` / `Template` / `Secret` exports,
 * except the options passed to the client are used as the defaults instead of
 * the environment variables.
 * Per-call options still take precedence over the client's options.
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
 * await client.Template.build(client.Template().fromPythonImage('3'), 'my-env')
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
   * `Template` bound to this client's connection configuration. Both the
   * builder (`client.Template()`) and the statics
   * (`client.Template.build(...)`, `client.Template.exists(...)`, …) work like
   * the top-level `Template`.
   */
  readonly Template: typeof Template

  /**
   * `Secret` class bound to this client's connection configuration.
   */
  readonly Secret: typeof Secret

  private readonly opts?: E2BClientOpts

  /**
   * Create a new client with the connection options bound to it.
   *
   * @param opts connection options used as the defaults for every call made
   *   through this client's resource classes.
   */
  constructor(opts?: E2BClientOpts) {
    this.opts = { ...opts }
    this.Sandbox = Sandbox.withOptions(opts)
    this.Volume = Volume.withOptions(opts)
    this.Secret = Secret.withOptions(opts)
    this.Template = Template.withOptions(opts)
  }

  /**
   * Create a new client that inherits this client's connection options and
   * overrides them with `opts`, with `opts` taking precedence.
   * This client is not modified.
   *
   * @param opts connection options to override.
   *
   * @returns a new `E2B` client with the merged options.
   *
   * @example
   * ```ts
   * const client = new E2B({ apiKey: 'e2b_...', requestTimeoutMs: 1234 })
   * const fastClient = client.withOptions({ requestTimeoutMs: 42 })
   * ```
   */
  withOptions(opts?: E2BClientOpts): E2B {
    return new E2B({ ...this.opts, ...opts })
  }
}
