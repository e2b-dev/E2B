import createClient, { FetchResponse } from 'openapi-fetch'

import type { components, paths } from './schema.gen'
import { defaultHeaders } from './metadata'
import { createApiFetch } from './http2'
import { ConnectionConfig } from '../connectionConfig'
import { AuthenticationError, RateLimitError, SandboxError } from '../errors'
import type { ErrorOptsWithStackTrace } from '../errors'
import { createApiLogger } from '../logs'
import { extractTraceId } from '../traceId'

const API_KEY_PATTERN = /^e2b_[0-9a-f]+$/
const API_KEY_EXAMPLE = `e2b_${'0'.repeat(40)}`

/**
 * Validates that an E2B API key has the expected `e2b_` prefix followed by
 * hex characters. Throws `AuthenticationError` otherwise.
 */
export function validateApiKey(apiKey: string): void {
  if (!API_KEY_PATTERN.test(apiKey)) {
    throw new AuthenticationError(
      `Invalid API key format: expected "e2b_" followed by hex characters (e.g. "${API_KEY_EXAMPLE}"). ` +
        'Visit the API Keys tab at https://e2b.dev/dashboard?tab=keys to get your API key.'
    )
  }
}

/**
 * Map an API error code and message to the matching error class — the same
 * mapping {@link handleApiError} applies to HTTP responses, usable for error
 * objects embedded in response bodies (e.g. per-fork results).
 */
export function apiErrorFromCode(
  code: number,
  content: unknown,
  errorClass: new (
    message: string,
    opts?: ErrorOptsWithStackTrace
  ) => Error = SandboxError,
  opts?: ErrorOptsWithStackTrace
): Error {
  // An expired key or a rate limit is a property of the request, not of the
  // builder step that happened to make it, so these two keep the frame where
  // they were constructed even when the caller supplied one.
  if (code === 401) {
    const message = 'Unauthorized, please check your credentials.'
    return new AuthenticationError(
      content ? `${message} - ${content}` : message,
      { traceId: opts?.traceId }
    )
  }

  if (code === 429) {
    const message = 'Rate limit exceeded, please try again later'
    return new RateLimitError(content ? `${message} - ${content}` : message, {
      traceId: opts?.traceId,
    })
  }

  return new errorClass(`${code}: ${content}`, opts)
}

export function handleApiError(
  response: FetchResponse<any, any, any>,
  errorClass: new (
    message: string,
    opts?: ErrorOptsWithStackTrace
  ) => Error = SandboxError,
  // `traceId` is read off the response, so only `stackTrace` is caller-supplied
  opts?: Pick<ErrorOptsWithStackTrace, 'stackTrace'>
): Error | undefined {
  // openapi-fetch leaves `error` undefined for non-2xx responses with
  // Content-Length: 0, so check the status instead
  if (response.response.ok) {
    return
  }

  const traceId = extractTraceId(response.response.headers)

  const status = response.response.status
  if (status === 401 || status === 429) {
    return apiErrorFromCode(
      status,
      response.error?.message ?? response.error,
      errorClass,
      { ...opts, traceId }
    )
  }

  return apiErrorFromCode(
    status,
    response.error?.message || response.error || response.response.statusText,
    errorClass,
    { ...opts, traceId }
  )
}

/**
 * Client for interacting with the E2B API.
 */
class ApiClient {
  readonly api: ReturnType<typeof createClient<paths>>

  constructor(
    config: ConnectionConfig,
    opts: {
      requireApiKey?: boolean
    } = {}
  ) {
    if ((opts.requireApiKey ?? true) && !config.apiKey) {
      throw new AuthenticationError(
        'API key is required, please visit the API Keys tab at https://e2b.dev/dashboard?tab=keys to get your API key. ' +
          'You can either set the environment variable `E2B_API_KEY` ' +
          "or you can pass it directly to the sandbox like Sandbox.create({ apiKey: 'e2b_...' })"
      )
    }

    if (config.apiKey && config.validateApiKey) {
      validateApiKey(config.apiKey)
    }

    this.api = createClient<paths>({
      baseUrl: config.apiUrl,
      fetch: createApiFetch(config.proxy),
      // In HTTP 1.1, all connections are considered persistent unless declared otherwise
      // keepalive: true,
      headers: {
        ...defaultHeaders,
        ...(config.apiKey && { 'X-API-KEY': config.apiKey }),
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
