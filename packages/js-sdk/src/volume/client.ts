import createClient from 'openapi-fetch'

import type { components, paths } from './schema.gen'
import { defaultHeaders, getEnvVar } from '../api/metadata'
import { createApiLogger, Logger } from '../logs'
import { Volume } from '..'

export interface VolumeConnectionOpts {
  /**
   * E2B API key to use for authentication.
   *
   * @default E2B_API_KEY // environment variable
   */
  apiKey?: string
  /**
   * API Url to use for the API.
   * @internal
   * @default E2B_API_URL // environment variable or `https://api.${domain}`
   */
  apiUrl?: string
  /**
   * Timeout for requests to the API in **milliseconds**.
   *
   * @default 60_000 // 60 seconds
   */
  requestTimeoutMs?: number
  /**
   * Logger to use for logging messages. It can accept any object that implements `Logger` interface—for example, {@link console}.
   */
  logger?: Logger

  /**
   * Additional headers to send with the request.
   */
  headers?: Record<string, string>
}

export class VolumeConnectionConfig {
  readonly apiUrl: string
  readonly apiKey?: string
  readonly headers?: Record<string, string>
  readonly logger?: Logger
  readonly requestTimeoutMs?: number

  constructor(volume: Volume, opts?: VolumeConnectionOpts) {
    this.apiUrl = opts?.apiUrl || VolumeConnectionConfig.apiUrl
    this.apiKey = opts?.apiKey || volume.apiKey
    this.headers = opts?.headers
    this.logger = opts?.logger
    this.requestTimeoutMs = opts?.requestTimeoutMs
  }

  getSignal(requestTimeoutMs?: number) {
    const timeout = requestTimeoutMs ?? this.requestTimeoutMs

    return timeout ? AbortSignal.timeout(timeout) : undefined
  }

  private static get apiUrl() {
    return getEnvVar('E2B_VOLUME_API_URL') || 'https://volumecontent.e2b.app'
  }
}

/**
 * Client for interacting with the E2B Volume API.
 */
class VolumeApiClient {
  readonly api: ReturnType<typeof createClient<paths>>

  constructor(
    config: VolumeConnectionConfig,
  ) {
    this.api = createClient<paths>({
      baseUrl: config.apiUrl,
      headers: {
        ...defaultHeaders,
        ...(config.apiKey && { 'Authorization': `Bearer ${config.apiKey}` }),
        ...config.headers,
      },
    })

    if (config.logger) {
      this.api.use(createApiLogger(config.logger))
    }
  }
}

export type { components as VolumeApiComponents, paths as VolumeApiPaths }
export { VolumeApiClient }
