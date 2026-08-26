import { ConnectionOpts } from './connectionConfig'
import { Sandbox } from './sandbox'
import { Secret } from './secret'
import { Template } from './template'
import { Volume } from './volume'

/**
 * Connection options bound to an {@link E2B} client.
 *
 * Same as {@link ConnectionOpts} without `signal`, which cancels a single
 * request and therefore can only be passed per call.
 */
export type E2BClientOpts = Omit<ConnectionOpts, 'signal'>

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

  /**
   * Create a new client with the connection options bound to it.
   *
   * @param opts connection options used as the defaults for every call made
   *   through this client's resource classes.
   */
  constructor(opts?: E2BClientOpts) {
    this.Sandbox = Sandbox.withOpts(opts)
    this.Volume = Volume.withOpts(opts)
    this.Secret = Secret.withOpts(opts)
    this.Template = Template.withOpts(opts)
  }
}
