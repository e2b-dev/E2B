import { ApiClient, components, handleApiError } from './api'
import { ConnectionConfig, ConnectionOpts } from './connectionConfig'
import { SecretError, SecretNotFoundError } from './errors'
import { Paginator } from './paginator'
import type { SandboxIamToken } from './sandbox/sandboxApi'

/**
 * Metadata of a secret. Secret values are write-only and never returned.
 */
export interface SecretInfo {
  /**
   * Secret ID.
   */
  secretId: string
  /**
   * Secret name, unique within the project.
   */
  name: string
  /**
   * Version served to readers that do not name one.
   */
  version: number
  /**
   * Customer metadata of the secret.
   */
  metadata: Record<string, string>
  /**
   * Time when the secret was created.
   */
  createdAt: Date
  /**
   * Time when the secret was last updated.
   */
  updatedAt: Date
}

export interface SecretCreateOpts extends ConnectionOpts {
  /**
   * Customer metadata to store with the secret.
   */
  metadata?: Record<string, string>
}

export interface SecretUpdateOpts extends ConnectionOpts {
  /**
   * Customer metadata to store with the secret. When provided, replaces the
   * stored metadata.
   */
  metadata?: Record<string, string>
}

export type SecretGetInfoOpts = ConnectionOpts

export type SecretExistsOpts = ConnectionOpts

export type SecretDestroyOpts = ConnectionOpts

export interface SecretListOpts extends Omit<ConnectionOpts, 'signal'> {
  /**
   * Number of secrets to return per page.
   *
   * @default 100
   */
  limit?: number

  /**
   * Token to the next page.
   */
  nextToken?: string
}

export interface SecretFillOpts {
  /**
   * Pin the placeholder to an immutable version instead of the current one.
   */
  version?: number
}

function convertSecretInfo(
  secret: components['schemas']['Secret']
): SecretInfo {
  return {
    secretId: secret.secretID,
    name: secret.name,
    version: secret.currentVersion,
    metadata: secret.metadata ?? {},
    createdAt: new Date(secret.createdAt),
    updatedAt: new Date(secret.updatedAt),
  }
}

/**
 * Paginator for listing secrets.
 *
 * @example
 * ```ts
 * const paginator = Secret.list()
 * while (paginator.hasNext) {
 *   const secrets = await paginator.nextItems()
 *   console.log(secrets)
 * }
 * ```
 */
export class SecretPaginator extends Paginator<SecretInfo> {
  constructor(opts?: SecretListOpts) {
    super(opts, opts?.limit, opts?.nextToken)
  }

  async nextItems(opts?: ConnectionOpts): Promise<SecretInfo[]> {
    if (!this.hasNext) {
      throw new Error('No more items to fetch')
    }

    const config = new ConnectionConfig({ ...this.opts, ...opts })
    const client = new ApiClient(config)

    const res = await client.api.GET('/secrets', {
      params: {
        query: {
          limit: this.limit,
          nextToken: this.nextToken,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs, opts?.signal),
    })

    const err = handleApiError(res, SecretError)
    if (err) {
      throw err
    }

    this.updatePagination(res.response)

    return (res.data ?? []).map(convertSecretInfo)
  }
}

/**
 * Module for managing E2B secrets and workload identity helpers.
 *
 * Secret values are write-only: they are accepted by {@link Secret.create}
 * and {@link Secret.update} but never returned by any read surface.
 */
export class Secret {
  /**
   * Create a new secret and its first value.
   *
   * @param name name of the secret, unique within the project.
   * @param value secret value. Write-only — never returned by the API.
   * @param opts connection options.
   *
   * @returns metadata of the created secret.
   */
  static async create(
    name: string,
    value: string,
    opts?: SecretCreateOpts
  ): Promise<SecretInfo> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.POST('/secrets', {
      body: {
        name,
        value,
        metadata: opts?.metadata,
      },
      signal: config.getSignal(opts?.requestTimeoutMs, opts?.signal),
    })

    const err = handleApiError(res, SecretError)
    if (err) {
      throw err
    }

    if (!res.data) {
      throw new Error('Response data is missing')
    }

    return convertSecretInfo(res.data)
  }

  /**
   * Update a secret's value by storing it as the secret's new version.
   *
   * @param secret secret ID or name.
   * @param value new secret value. Write-only — never returned by the API.
   * @param opts connection options.
   *
   * @returns metadata of the updated secret.
   */
  static async update(
    secret: string,
    value: string,
    opts?: SecretUpdateOpts
  ): Promise<SecretInfo> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.POST('/secrets/{secretID}', {
      params: {
        path: {
          secretID: secret,
        },
      },
      body: {
        value,
        metadata: opts?.metadata,
      },
      signal: config.getSignal(opts?.requestTimeoutMs, opts?.signal),
    })

    if (res.response.status === 404) {
      throw new SecretNotFoundError(`Secret ${secret} not found`)
    }

    const err = handleApiError(res, SecretError)
    if (err) {
      throw err
    }

    if (!res.data) {
      throw new Error('Response data is missing')
    }

    return convertSecretInfo(res.data)
  }

  /**
   * Get a secret's metadata.
   *
   * @param secret secret ID or name.
   * @param opts connection options.
   *
   * @returns metadata of the secret.
   */
  static async getInfo(
    secret: string,
    opts?: SecretGetInfoOpts
  ): Promise<SecretInfo> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.GET('/secrets/{secretID}', {
      params: {
        path: {
          secretID: secret,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs, opts?.signal),
    })

    if (res.response.status === 404) {
      throw new SecretNotFoundError(`Secret ${secret} not found`)
    }

    const err = handleApiError(res, SecretError)
    if (err) {
      throw err
    }

    if (!res.data) {
      throw new Error('Response data is missing')
    }

    return convertSecretInfo(res.data)
  }

  /**
   * List the project's secrets.
   *
   * @param opts connection options.
   *
   * @returns paginator of secret metadata.
   */
  static list(opts?: SecretListOpts): SecretPaginator {
    return new SecretPaginator(opts)
  }

  /**
   * Check whether a secret exists.
   *
   * @param secret secret ID or name.
   * @param opts connection options.
   *
   * @returns `true` if the secret exists, `false` otherwise.
   */
  static async exists(
    secret: string,
    opts?: SecretExistsOpts
  ): Promise<boolean> {
    try {
      await Secret.getInfo(secret, opts)
      return true
    } catch (err) {
      if (err instanceof SecretNotFoundError) {
        return false
      }
      throw err
    }
  }

  /**
   * Destroy a secret, making all its versions inaccessible.
   *
   * @param secret secret ID or name.
   * @param opts connection options.
   *
   * @returns `true` if the secret was destroyed, `false` if it was not found.
   */
  static async destroy(
    secret: string,
    opts?: SecretDestroyOpts
  ): Promise<boolean> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.DELETE('/secrets/{secretID}', {
      params: {
        path: {
          secretID: secret,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs, opts?.signal),
    })

    if (res.response.status === 404) {
      return false
    }

    const err = handleApiError(res, SecretError)
    if (err) {
      throw err
    }

    return true
  }

  /**
   * Format a placeholder that the runtime resolves to the secret's value.
   *
   * This is a local formatting helper and makes no network call — it does
   * not check whether the named secret or requested version exists. An
   * unknown reference fails server-side when the placeholder is resolved.
   *
   * @param secret secret name.
   * @param opts fill options.
   * @param [opts.version] pin the placeholder to an immutable version.
   *
   * @returns placeholder string resolving to the secret's value.
   *
   * @example
   * ```ts
   * Secret.fill('openai-api-key')
   * // '${e2b.secrets.openai-api-key}'
   *
   * Secret.fill('openai-api-key', { version: 2 })
   * // '${e2b.secrets.openai-api-key:2}'
   * ```
   */
  static fill(secret: string, opts?: SecretFillOpts): string {
    const version = opts?.version !== undefined ? `:${opts.version}` : ''
    return `\${e2b.secrets.${secret}${version}}`
  }

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
