import createClient from 'openapi-fetch'

import type { components, paths } from './schema.gen'
import { ConnectionConfig } from '../connectionConfig'

class EnvdApiClient {
  private readonly client: ReturnType<typeof createClient<paths>>

  constructor(config: Pick<ConnectionConfig, 'apiUrl'>) {
    this.client = createClient<paths>({
      baseUrl: config.apiUrl,
    })
  }

  get api() {
    return this.client
  }
}

export type { components, paths }
export { EnvdApiClient }
