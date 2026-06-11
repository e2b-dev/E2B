import createClient, { FetchResponse } from 'openapi-fetch'

import type { components, paths } from './schema.gen'
import { defaultHeaders } from './metadata'
import { createApiFetch } from './http2'
import { ConnectionConfig } from '../connectionConfig'
import { AuthenticationError, RateLimitError, SandboxError } from '../errors'
import { createApiLogger } from '../logs'
import { escapeRegExp } from '../utils'

export const DEFAULT_API_KEY_PREFIX = 'e2b_'

/**
 * Validates that an E2B API key has the expected prefix followed by hex
 * characters. Throws `AuthenticationError` otherwise. The prefix defaults to
 * `e2b_` and can be overridden via the `E2B_API_KEY_PREFIX` env var or the
 * `apiKeyPrefix` connection option.
 */
export function validateApiKey(
  apiKey: string,
  prefix: string = DEFAULT_API_KEY_PREFIX
): void {
  const pattern = new RegExp(`^${escapeRegExp(prefix)}[0-9a-f]+$`)
  if (!pattern.test(apiKey)) {
    const example = `${prefix}${'0'.repeat(40)}`
    throw new AuthenticationError(
      `Invalid API key format: expected "${prefix}" followed by hex characters (e.g. "${example}"). ` +
        'Visit the API Keys tab at https://e2b.dev/dashboard?tab=keys to get your API key.'
    )
  }
}

export function handleApiError(
  response: FetchResponse<any, any, any>,
  errorClass: new (
    message: string,
    stackTrace?: string
  ) => Error = SandboxError,
  stackTrace?: string
): Error | undefined {
  // openapi-fetch returns empty string for error when response body is empty,
  // so we check !== undefined instead of truthiness
  if (response.error === undefined) {
    return
  }

  if (response.response.status === 401) {
    const message = 'Unauthorized, please check your credentials.'
    const content = response.error?.message ?? response.error

    if (content) {
      return new AuthenticationError(`${message} - ${content}`)
    }
    return new AuthenticationError(message)
  }

  if (response.response.status === 429) {
    const message = 'Rate limit exceeded, please try again later'
    const content = response.error?.message ?? response.error

    if (content) {
      return new RateLimitError(`${message} - ${content}`)
    }
    return new RateLimitError(message)
  }

  const message = response.error?.message ?? response.error
  return new errorClass(`${response.response.status}: ${message}`, stackTrace)
}

/**
 * Client for interacting with the E2B API.
 */
class ApiClient {
  readonly api: ReturnType<typeof createClient<paths>>

  constructor(
    config: ConnectionConfig,
    opts: {
      requireAccessToken?: boolean
      requireApiKey?: boolean
    } = { requireAccessToken: false, requireApiKey: false }
  ) {
    if (opts?.requireApiKey && !config.apiKey) {
      throw new AuthenticationError(
        'API key is required, please visit the Team tab at https://e2b.dev/dashboard to get your API key. ' +
          'You can either set the environment variable `E2B_API_KEY` ' +
          "or you can pass it directly to the sandbox like Sandbox.create({ apiKey: 'e2b_...' })"
      )
    }

    if (config.apiKey) {
      validateApiKey(config.apiKey, config.apiKeyPrefix)
    }

    if (opts?.requireAccessToken && !config.accessToken) {
      throw new AuthenticationError(
        'Access token is required, please visit the Personal tab at https://e2b.dev/dashboard to get your access token. ' +
          'You can set the environment variable `E2B_ACCESS_TOKEN` or pass the `accessToken` in options.'
      )
    }

    this.api = createClient<paths>({
      baseUrl: config.apiUrl,
      fetch: createApiFetch(config.proxy),
      // In HTTP 1.1, all connections are considered persistent unless declared otherwise
      // keepalive: true,
      headers: {
        ...defaultHeaders,
        ...(config.apiKey && { 'X-API-KEY': config.apiKey }),
        ...(config.accessToken && {
          Authorization: `Bearer ${config.accessToken}`,
        }),
        ...config.headers,
      },
      querySerializer: {
        array: {
          style: 'form',
          explode: false,
        },
      },
    })

    if (config.logger) {
      this.api.use(createApiLogger(config.logger))
    }
  }
}

export type { components, paths }
export { ApiClient }
