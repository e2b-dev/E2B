import createClient, { FetchResponse } from 'openapi-fetch'

import type { components, paths } from './schema.gen'
import { ConnectionConfig } from '../connectionConfig'
import { createApiLogger } from '../logs'
import { SandboxError, InvalidArgumentError, NotFoundError, NotEnoughSpaceError, formatSandboxTimeoutError, AuthenticationError } from '../errors'

export async function handleEnvdApiError<A, B, C extends `${string}/${string}`>(res: FetchResponse<A, B, C>) {
  if (!res.error) {
    return
  }

  const message: string = typeof res.error == 'string' ? res.error : res.error?.message || await res.response.text()

  switch (res.response.status) {
    case 400:
      return new InvalidArgumentError(message)
    case 401:
      return new AuthenticationError(message)
    case 404:
      return new NotFoundError(message)
    case 429:
      return new SandboxError(`${res.response.status}: ${message}: The requests are being rate limited.`)
    case 502:
      return formatSandboxTimeoutError(message)
    case 507:
      return new NotEnoughSpaceError(message)
    default:
      return new SandboxError(`${res.response.status}: ${message}`)
  }
}

class EnvdApiClient {
  readonly api: ReturnType<typeof createClient<paths>>

  constructor(config: Pick<ConnectionConfig, 'apiUrl' | 'logger'>) {
    this.api = createClient({
      baseUrl: config.apiUrl,
      keepalive: true,
    })

    if (config.logger) {
      this.api.use(createApiLogger(config.logger))
    }
  }
}

export type { components, paths }
export { EnvdApiClient }
