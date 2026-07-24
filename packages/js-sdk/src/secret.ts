import type { SandboxIamToken } from './sandbox/sandboxApi'

/**
 * Options for {@link Secret.iamToken}.
 */
export interface SecretIamTokenOpts {
  /**
   * Audience of the workload token, stored exactly as provided.
   */
  audience: string

  /**
   * Workload token type.
   */
  tokenType: string
}

/**
 * Secrets and workload identity helpers.
 */
export class Secret {
  /**
   * Define a workload identity token to pass to `iam.tokens` when creating
   * a sandbox.
   *
   * @param opts workload token definition.
   *
   * @returns a token definition passable to `iam.tokens`.
   *
   * @example
   * ```ts
   * const sandbox = await Sandbox.create({
   *   iam: {
   *     tokens: {
   *       aws: Secret.iamToken({
   *         audience: 'sts.amazonaws.com',
   *         tokenType: 'JWT-SVID',
   *       }),
   *     },
   *   },
   * })
   * ```
   */
  static iamToken(opts: SecretIamTokenOpts): SandboxIamToken {
    return {
      audience: opts.audience,
      tokenType: opts.tokenType,
    }
  }
}
