import createClient from 'openapi-fetch'

import type { components, paths } from './schema.gen'
import { defaultHeaders } from './metadata'
import { ConnectionConfig } from '../connectionConfig'

export class AuthenticationError extends Error {
  constructor(message: any) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

class ApiClient {
  private readonly client: ReturnType<typeof createClient<paths>>

  constructor(
    config: ConnectionConfig,
    opts?: {
      requireAccessToken?: boolean
      requireApiKey?: boolean
    },
  ) {
    if (!opts?.requireApiKey && !config.apiKey) {
      throw new AuthenticationError(
        'API key is required, please visit https://e2b.dev/docs to get your API key. ' +
        'You can either set the environment variable `E2B_API_KEY` ' +
        "or you can pass it directly to the sandbox like Sandbox.create({ apiKey: 'e2b_...' })",
      )
    }

    if (opts?.requireAccessToken && !config.accessToken) {
      throw new AuthenticationError(
        'Access token is required, please visit https://e2b.dev/docs to get your access token. ' +
        'You can set the environment variable `E2B_ACCESS_TOKEN` or pass the `accessToken` in options.',
      )
    }

    this.client = createClient<paths>({
      baseUrl: config.apiUrl,
      signal: config.requestTimeoutMs ? AbortSignal.timeout(config.requestTimeoutMs) : undefined,
      headers: {
        ...defaultHeaders,
        ...config.apiKey && { 'X-API-KEY': config.apiKey },
        ...config.accessToken && { Authorization: `Bearer ${config.accessToken}` },
      },
    })
  }

  get api() {
    return this.client
  }
}

export type { components, paths }
export { ApiClient }
