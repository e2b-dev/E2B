import createClient from 'openapi-fetch'

import type { components, paths } from './schema.gen'
import { ConnectionConfig } from '../connectionConfig'
import { createApiLogger } from '../logs'
import { SandboxError, InvalidArgumentError, NotFoundError, NotEnoughSpaceError, formatSandboxTimeoutError, AuthenticationError } from '../errors'

export function handleEnvdApiError(err: {
  code: number;
  message: string;
} | undefined) {
  switch (err?.code) {
    case 400:
      return new InvalidArgumentError(err.message)
    case 401:
      return new AuthenticationError(err.message)
    case 404:
      return new NotFoundError(err.message)
    case 429:
      return new SandboxError(`${err.code}: ${err.message}: The requests are being rate limited.`)
    case 502:
      return formatSandboxTimeoutError(err.message)
    case 507:
      return new NotEnoughSpaceError(err.message)
    default:
      if (err) {
        return new SandboxError(`${err.code}: ${err.message}`)
      }
  }
}

class EnvdApiClient {
  private readonly client: ReturnType<typeof createClient<paths>>

  constructor(config: Pick<ConnectionConfig, 'apiUrl' | 'logger'>) {
    this.client = createClient<paths>({
      baseUrl: config.apiUrl,
      keepalive: true,
    })

    if (config.logger) {
      this.client.use(createApiLogger(config.logger))
    }
  }

  get api() {
    return this.client
  }
}

export type { components, paths }
export { EnvdApiClient }
