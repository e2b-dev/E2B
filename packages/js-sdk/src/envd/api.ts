import createClient from 'openapi-fetch'

import type { components, paths } from './schema.gen'
import { ConnectionConfig } from '../connectionConfig'
import { createApiLogger } from '../logs'
import { getProxyFetch } from '../proxy'
import {
  SandboxError,
  InvalidArgumentError,
  NotFoundError,
  NotEnoughSpaceError,
  SandboxNotFoundError,
  formatSandboxTimeoutError,
  AuthenticationError,
} from '../errors'
import { StartResponse, ConnectResponse } from './process/process_pb'
import { Code, ConnectError } from '@connectrpc/connect'
import { WatchDirResponse } from './filesystem/filesystem_pb'

type ApiError = { message?: string } | string

const DEFAULT_ERROR_MAP: Record<number, (message: string) => Error> = {
  400: (message) => new InvalidArgumentError(message),
  401: (message) => new AuthenticationError(message),
  404: (message) => new NotFoundError(message),
  429: (message) =>
    new SandboxError(`${message}: The requests are being rate limited.`),
  502: formatSandboxTimeoutError,
  507: (message) => new NotEnoughSpaceError(message),
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
  if (!res.error) {
    return
  }

  const message: string =
    typeof res.error == 'string'
      ? res.error
      : res.error?.message || (await res.response.text())

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
  let startEvent: StartResponse | ConnectResponse

  try {
    startEvent = (await events[Symbol.asyncIterator]().next()).value
  } catch (err) {
    if (err instanceof ConnectError) {
      if (err.code === Code.Unavailable) {
        throw new SandboxNotFoundError(
          'Sandbox is probably not running anymore'
        )
      }
    }

    throw err
  }
  if (startEvent.event?.event.case !== 'start') {
    throw new Error('Expected start event')
  }

  return startEvent.event.event.value.pid
}

export async function handleWatchDirStartEvent(
  events: AsyncIterable<WatchDirResponse>
) {
  let startEvent: WatchDirResponse

  try {
    startEvent = (await events[Symbol.asyncIterator]().next()).value
  } catch (err) {
    if (err instanceof ConnectError) {
      if (err.code === Code.Unavailable) {
        throw new SandboxNotFoundError(
          'Sandbox is probably not running anymore'
        )
      }
    }

    throw err
  }
  if (startEvent.event?.case !== 'start') {
    throw new Error('Expected start event')
  }

  return startEvent.event.value
}

class EnvdApiClient {
  readonly api: ReturnType<typeof createClient<paths>>
  readonly version: string

  constructor(
    config: Pick<ConnectionConfig, 'apiUrl' | 'logger' | 'accessToken'> & {
      fetch?: (request: Request) => ReturnType<typeof fetch>
      headers?: Record<string, string>
    },
    metadata: {
      version: string
    }
  ) {
    this.api = createClient({
      baseUrl: config.apiUrl,
      fetch: config?.fetch ?? getProxyFetch(),
      headers: config?.headers,
      // In HTTP 1.1, all connections are considered persistent unless declared otherwise
      // keepalive: true,
    })
    this.version = metadata.version

    if (config.logger) {
      this.api.use(createApiLogger(config.logger))
    }
  }
}

export type { components, paths }
export { EnvdApiClient }
