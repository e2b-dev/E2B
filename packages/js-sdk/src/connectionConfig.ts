import { Logger } from './logs'
import { getEnvVar } from './api/metadata'

const REQUEST_TIMEOUT_MS = 30_000 // 30 seconds
export const KEEPALIVE_PING_INTERVAL_SEC = 50 // 50 seconds

export const KEEPALIVE_PING_HEADER = 'Keepalive-Ping-Interval'

/**
 * Connection options for requests to the API.
 */
export interface ConnectionOpts {
  /**
   * E2B API key to use for authentication.
   * 
   * @default `E2B_API_KEY` // environment variable
   */
  apiKey?: string
  /**
   * E2B access token to use for authentication.
   * 
   * @default `E2B_ACCESS_TOKEN` // environment variable
   */
  accessToken?: string
  /**
   * Domain to use for the API.
   * 
   * @default `E2B_DOMAIN` // environment variable or `e2b.dev`
   */
  domain?: string
  /**
   * If true the SDK starts in the debug mode and **connects to the local envd API server**.
   * 
   * @default `E2B_DEBUG` // environment variable or `false`
   */
  debug?: boolean
  /**
   * Timeout for requests to the API in **milliseconds**.
   * 
   * @default 30_000 // (30 seconds)
   */
  requestTimeoutMs?: number
  /**
   * Logger to use for logging messages. It can accept any object that implements `Logger` interface—for example, {@link console}.
   */
  logger?: Logger
}

/**
 * Configuration for connecting to the API.
 */
export class ConnectionConfig {
  readonly debug: boolean
  readonly domain: string
  readonly apiUrl: string
  readonly logger?: Logger

  readonly requestTimeoutMs: number

  readonly apiKey?: string
  readonly accessToken?: string

  constructor(opts?: ConnectionOpts) {
    this.apiKey = opts?.apiKey || ConnectionConfig.apiKey
    this.debug = opts?.debug || ConnectionConfig.debug
    this.domain = opts?.domain || ConnectionConfig.domain
    this.accessToken = opts?.accessToken || ConnectionConfig.accessToken
    this.requestTimeoutMs = opts?.requestTimeoutMs ?? REQUEST_TIMEOUT_MS
    this.logger = opts?.logger

    this.apiUrl = this.debug
      ? 'http://localhost:3000'
      : `https://api.${this.domain}`
  }

  private static get domain() {
    return getEnvVar('E2B_DOMAIN') || 'e2b.dev'
  }

  private static get debug() {
    return (getEnvVar('E2B_DEBUG') || 'false').toLowerCase() === 'true'
  }

  private static get apiKey() {
    return getEnvVar('E2B_API_KEY')
  }

  private static get accessToken() {
    return getEnvVar('E2B_ACCESS_TOKEN')
  }

  getSignal(requestTimeoutMs?: number) {
    const timeout = requestTimeoutMs ?? this.requestTimeoutMs

    return timeout ? AbortSignal.timeout(timeout) : undefined
  }
}

/**
 * User used for the operation in the sandbox.
 */
export type Username = 'root' | 'user'

export const defaultUsername: Username = 'user'
