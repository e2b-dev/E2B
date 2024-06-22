import createClient from 'openapi-fetch'

import type { components, paths } from './schema.gen'
import { ConnectionConfig } from '../connectionConfig'
import { createApiLogger } from '../logs'
import { SandboxError, InvalidUserError, InvalidPathError, NotFoundError, NotEnoughDiskSpaceError, formatSandboxTimeoutError } from '../errors'

export function handleEnvdApiError(err: {
  code: number;
  message: string;
} | undefined) {
  switch (err?.code) {
    case 400:
      return new InvalidUserError(err.message)
    case 403:
      return new InvalidPathError(err.message)
    case 404:
      return new NotFoundError(err.message)
    case 412:
      return new InvalidPathError(err.message)
    case 502:
      return formatSandboxTimeoutError(err.message)
    case 507:
      return new NotEnoughDiskSpaceError(err.message)
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
