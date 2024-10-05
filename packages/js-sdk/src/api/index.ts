import createClient from 'openapi-fetch'

import type { components, paths } from './schema.gen'
import { defaultHeaders } from './metadata'
import { ConnectionConfig } from '../connectionConfig'
import { AuthenticationError, SandboxError } from '../errors'
import { createApiLogger } from '../logs'

export function handleApiError(err?: { code: number; message: string; }) {
  if (!err) {
    return
  }

  return new SandboxError(`${err.code}: ${err.message}`)
}

class ApiClient {
  readonly api: ReturnType<typeof createClient<paths>>

  constructor(
    config: ConnectionConfig,
    opts: {
      requireAccessToken?: boolean
      requireApiKey?: boolean
    } = { requireAccessToken: false, requireApiKey: true },
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

    this.api = createClient<paths>({
      baseUrl: config.apiUrl,
      // keepalive: true, // TODO: Return keepalive
      headers: {
        ...defaultHeaders,
        ...config.apiKey && { 'X-API-KEY': config.apiKey },
        ...config.accessToken && { Authorization: `Bearer ${config.accessToken}` },
      },
    })

    if (config.logger) {
      this.api.use(createApiLogger(config.logger))
    }
  }
}

export type { components, paths }
export { ApiClient }
