import createClient from 'openapi-fetch'

import type { components, paths } from './schema.gen'
import { defaultHeaders, getEnvVar } from '../api/metadata'
import { buildRequestSignal } from '../connectionConfig'
import { createApiLogger, Logger } from '../logs'
import type { Volume } from './index'

const FILE_TIMEOUT_MS = 3_600_000 // 1 hour

export interface VolumeApiOpts {
  /**
   * E2B API key to use for authentication.
   *
   * @default E2B_API_KEY // environment variable
   */
  token?: string
  /**
   * Domain to use for the volume API.
   *
   * @default E2B_DOMAIN // environment variable or `e2b.app`
   */
  domain?: string
  /**
   * If true the SDK starts in the debug mode and connects to the local volume API server.
   * @internal
   * @default E2B_DEBUG // environment variable or `false`
   */
  debug?: boolean
  /**
   * API Url to use for the API.
   * @internal
   * @default E2B_VOLUME_API_URL // environment variable or `https://api.${domain}`
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

  /**
   * An optional `AbortSignal` that can be used to cancel the in-flight request.
   * When the signal is aborted, the underlying `fetch` is aborted and the
   * returned promise rejects with an `AbortError`.
   */
  signal?: AbortSignal
}

export class VolumeConnectionConfig {
  readonly domain: string
  readonly debug: boolean
  readonly apiUrl: string
  readonly token?: string
  readonly headers?: Record<string, string>
  readonly logger?: Logger
  readonly requestTimeoutMs?: number

  constructor(volume: Volume, opts?: VolumeApiOpts) {
    this.domain = opts?.domain || volume.domain || VolumeConnectionConfig.domain
    this.debug = opts?.debug ?? volume.debug ?? VolumeConnectionConfig.debug
    this.apiUrl =
      opts?.apiUrl ||
      VolumeConnectionConfig.volumeApiUrl ||
      (this.debug ? 'http://localhost:8080' : `https://api.${this.domain}`)
    this.token = opts?.token || volume.token
    this.headers = opts?.headers
    this.logger = opts?.logger
    this.requestTimeoutMs = opts?.requestTimeoutMs
  }

  private static get domain() {
    return getEnvVar('E2B_DOMAIN') || 'e2b.app'
  }

  private static get debug() {
    return (getEnvVar('E2B_DEBUG') || 'false').toLowerCase() === 'true'
  }

  private static get volumeApiUrl() {
    return getEnvVar('E2B_VOLUME_API_URL')
  }

  getSignal(requestTimeoutMs?: number, signal?: AbortSignal) {
    return buildRequestSignal(requestTimeoutMs ?? this.requestTimeoutMs, signal)
  }
}

/**
 * Client for interacting with the E2B Volume API.
 */
class VolumeApiClient {
  readonly api: ReturnType<typeof createClient<paths>>

  constructor(config: VolumeConnectionConfig) {
    this.api = createClient<paths>({
      baseUrl: config.apiUrl,
      headers: {
        ...defaultHeaders,
        ...(config.token && { Authorization: `Bearer ${config.token}` }),
        ...config.headers,
      },
    })

    if (config.logger) {
      this.api.use(createApiLogger(config.logger))
    }
  }
}

export type { components as VolumeApiComponents, paths as VolumeApiPaths }
export { VolumeApiClient, FILE_TIMEOUT_MS }
