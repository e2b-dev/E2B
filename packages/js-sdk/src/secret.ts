import type { SandboxIamToken } from './sandbox/sandboxApi'

/**
 * Secrets and workload identity helpers.
 */
export class Secret {
  /**
   * Define a workload identity token to pass to `iam.tokens` when creating
   * a sandbox.
   *
   * @param token workload token definition.
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
  static iamToken(token: SandboxIamToken): SandboxIamToken {
    return { ...token }
  }
}
