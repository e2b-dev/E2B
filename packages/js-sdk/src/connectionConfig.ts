import { Logger } from './logs'
import { getEnvVar } from './api/metadata'

const REQUEST_TIMEOUT_MS = 30_000  // 30s
export const KEEPALIVE_PING_INTERVAL_SEC = 50 // 50s

export const KEEPALIVE_PING_HEADER = 'Keepalive-Ping-Interval'

export interface ConnectionOpts {
  apiKey?: string
  accessToken?: string
  domain?: string
  debug?: boolean
  requestTimeoutMs?: number
  logger?: Logger
}

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

    this.apiUrl = this.debug ? 'http://localhost:3000' : `https://api.${this.domain}`
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

export type Username = 'root' | 'user'

export const defaultUsername: Username = 'user'
