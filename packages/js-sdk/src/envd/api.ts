import createClient from 'openapi-fetch'

import type { components, paths } from './schema.gen'
import { ConnectionConfig } from '../connectionConfig'
import { createApiLogger } from '../logs'
import {
  SandboxError,
  InvalidArgumentError,
  NotFoundError,
  NotEnoughSpaceError,
  formatSandboxTimeoutError,
  AuthenticationError,
} from '../errors'
import { StartResponse, ConnectResponse } from './process/process_pb'
import { Code, ConnectError } from '@connectrpc/connect'
import { WatchDirResponse } from './filesystem/filesystem_pb'

type ApiError = { message?: string } | string

export async function handleEnvdApiError(res: {
  error?: ApiError
  response: Response
}) {
  if (!res.error) {
    return
  }

  const message: string =
    typeof res.error == 'string'
      ? res.error
      : res.error?.message || (await res.response.text())

  switch (res.response.status) {
    case 400:
      return new InvalidArgumentError(message)
    case 401:
      return new AuthenticationError(message)
    case 404:
      return new NotFoundError(message)
    case 429:
      return new SandboxError(
        `${res.response.status}: ${message}: The requests are being rate limited.`
      )
    case 502:
      return formatSandboxTimeoutError(message)
    case 507:
      return new NotEnoughSpaceError(message)
    default:
      return new SandboxError(`${res.response.status}: ${message}`)
  }
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
        throw new NotFoundError('Sandbox is probably not running anymore')
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
        throw new NotFoundError('Sandbox is probably not running anymore')
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
      fetch: config?.fetch,
      headers: config?.headers,
      // keepalive: true, // TODO: Return keepalive
    })
    this.version = metadata.version

    if (config.logger) {
      this.api.use(createApiLogger(config.logger))
    }
  }
}

export type { components, paths }
export { EnvdApiClient }
