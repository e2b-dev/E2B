import createClient from 'openapi-fetch'

import type { components, paths } from './schema.gen'
import { ConnectionConfig } from '../connectionConfig'
import { createApiLogger } from '../logs'

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
