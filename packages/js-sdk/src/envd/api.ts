import createClient from 'openapi-fetch'

import type { components, paths } from './schema.gen'
import { ConnectionConfig } from '../connectionConfig'
import { createApiLogger } from '../logs'
import {
  SandboxError,
  InvalidArgumentError,
  NotFoundError,
  NotEnoughSpaceError,
  formatSandboxUnavailableError,
  SandboxNotRunningError,
  AuthenticationError,
  RateLimitError,
} from '../errors'
import { StartResponse, ConnectResponse } from './process/process_pb'
import { WatchDirResponse } from './filesystem/filesystem_pb'
import {
  isConnectionTerminatedMessage,
  resolveTransportFailure,
  SandboxHealthCheck,
} from './rpc'
import { isNetworkError } from '../retry'

type ApiError = { message?: string } | string

const DEFAULT_ERROR_MAP: Record<number, (message: string) => Error> = {
  400: (message) => new InvalidArgumentError(message),
  401: (message) => new AuthenticationError(message),
  404: (message) => new NotFoundError(message),
  429: (message) =>
    new RateLimitError(`${message}: The requests are being rate limited.`),
  502: formatSandboxUnavailableError,
  507: (message) => new NotEnoughSpaceError(message),
}

const HEALTH_CHECK_TIMEOUT_MS = 5_000

/**
 * Probes the sandbox's envd health endpoint.
 *
 * @param envdApi - The envd API client of the sandbox; the probe goes through its `health` client, which runs without connection retries so a sandbox that cannot be reached is not tried all over again.
 * @returns `true` if the sandbox is running, `false` if it is not, `undefined` if it answered but its state could not be determined.
 * @throws The `fetch` failure when the sandbox could not be reached (no answer within the probe timeout), or the `SandboxUnreachableError` a request would get when the proxy reports the sandbox running but envd's port not open.
 */
export async function checkSandboxHealth(
  envdApi: EnvdApiClient
): Promise<boolean | undefined> {
  const res = await envdApi.health.GET('/health', {
    signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
  })

  if (res.response.status === 502) {
    const err = formatSandboxUnavailableError(await getEnvdApiErrorMessage(res))
    if (err instanceof SandboxNotRunningError) {
      return false
    }
    throw err
  }
  if (res.response.ok) {
    return true
  }

  return undefined
}

/**
 * Checks whether a `fetch` rejection is a transport-level failure of the request to
 * the sandbox: the connection could not be established or was dropped mid-request
 * (the latter surfaces with runtime-specific wording, e.g. undici's `terminated`).
 */
export function isFetchTransportFailure(err: unknown): err is Error {
  return (
    err instanceof Error &&
    (isConnectionTerminatedMessage(err.message) || isNetworkError(err))
  )
}

/**
 * Handles transport-level fetch failures from envd API calls. When the connection to
 * the sandbox could not be established or was dropped mid-request, probes the sandbox
 * health to tell apart the sandbox being killed from the sandbox being unreachable or
 * a transient network failure (e.g. a load balancer dropping the connection).
 *
 * @param err - The caught error, expected to be a fetch transport failure.
 * @param checkHealth - Probe resolving to whether the sandbox is running (`undefined` when unknown) and rejecting when it cannot be reached.
 * @returns A `SandboxNotRunningError` when the sandbox is confirmed gone, a `SandboxUnreachableError` when the probe got no answer either, or the original error otherwise.
 */
export async function handleEnvdApiFetchError(
  err: unknown,
  checkHealth?: SandboxHealthCheck
): Promise<Error> {
  if (checkHealth && isFetchTransportFailure(err)) {
    const resolved = await resolveTransportFailure(err, checkHealth)
    if (resolved) {
      return resolved
    }
  }

  return err as Error
}

/**
 * Extracts the error message of a non-2xx envd API response: the `message` of its
 * JSON body, else its text body, else its status text.
 */
export async function getEnvdApiErrorMessage(res: {
  error?: ApiError
  response: Response
}): Promise<string> {
  let message =
    (typeof res.error === 'string' ? res.error : res.error?.message) ?? ''

  // openapi-fetch consumes the body when parsing the error, except for
  // responses without content
  if (!message && !res.response.bodyUsed) {
    try {
      message = await res.response.text()
    } catch {
      // ignore unreadable bodies
    }
  }

  return message || res.response.statusText
}

/**
 * Handles errors from envd API responses by mapping HTTP status codes to specific error types.
 *
 * @param res - The API response object containing an optional error and the raw `Response`.
 * @param errorMap - Optional map of HTTP status codes to error factory functions that override the defaults.
 * @returns The corresponding `Error` instance if an error is present, or `undefined` if the response is successful.
 */
export async function handleEnvdApiError(
  res: {
    error?: ApiError
    response: Response
  },
  errorMap?: Record<number, (message: string) => Error>
) {
  // openapi-fetch leaves `error` empty for non-2xx responses without content
  // (undefined for Content-Length: 0, '' for an empty body without the
  // header), so check the status instead
  if (res.response.ok) {
    return
  }

  const message = await getEnvdApiErrorMessage(res)

  // Check if a custom error mapping is provided for this error code
  if (errorMap && res.response.status in errorMap) {
    return errorMap[res.response.status]?.(message)
  }

  // Check if there is a default error mapping for this error code
  if (res.response.status in DEFAULT_ERROR_MAP) {
    return DEFAULT_ERROR_MAP[res.response.status]?.(message)
  }

  // Fallback to a generic SandboxError if no specific mapping is found
  return new SandboxError(`${res.response.status}: ${message}`)
}

export async function handleProcessStartEvent(
  events: AsyncIterable<StartResponse | ConnectResponse>
) {
  const startEvent: StartResponse | ConnectResponse = (
    await events[Symbol.asyncIterator]().next()
  ).value
  if (startEvent.event?.event.case !== 'start') {
    throw new Error('Expected start event')
  }

  return startEvent.event.event.value.pid
}

export async function handleWatchDirStartEvent(
  events: AsyncIterable<WatchDirResponse>
) {
  const startEvent: WatchDirResponse = (
    await events[Symbol.asyncIterator]().next()
  ).value
  if (startEvent.event?.case !== 'start') {
    throw new Error('Expected start event')
  }

  return startEvent.event.value
}

class EnvdApiClient {
  readonly api: ReturnType<typeof createClient<paths>>
  /**
   * Client for the health probe run after a request failed: the same API over
   * `healthFetch` (no connection retries), or `api` itself when not given.
   */
  readonly health: ReturnType<typeof createClient<paths>>
  readonly version: string

  constructor(
    config: Pick<ConnectionConfig, 'apiUrl' | 'logger'> & {
      /**
       * Sandbox-scoped envd access token, sent as the `X-Access-Token` header.
       */
      envdAccessToken?: string
      fetch?: (request: Request) => ReturnType<typeof fetch>
      /**
       * `fetch` for the health probe, without connection retries.
       */
      healthFetch?: (request: Request) => ReturnType<typeof fetch>
      headers?: Record<string, string>
    },
    metadata: {
      version: string
    }
  ) {
    const build = (
      fetchImpl?: (request: Request) => ReturnType<typeof fetch>
    ) =>
      createClient<paths>({
        baseUrl: config.apiUrl,
        fetch: fetchImpl,
        headers: {
          ...config?.headers,
          ...(config.envdAccessToken && {
            'X-Access-Token': config.envdAccessToken,
          }),
        },
        // In HTTP 1.1, all connections are considered persistent unless declared otherwise
        // keepalive: true,
      })
    this.api = build(config?.fetch)
    this.health = config.healthFetch ? build(config.healthFetch) : this.api
    this.version = metadata.version

    if (config.logger) {
      this.api.use(createApiLogger(config.logger))
      if (this.health !== this.api) {
        this.health.use(createApiLogger(config.logger))
      }
    }
  }
}

export type { components, paths }
export { EnvdApiClient }
