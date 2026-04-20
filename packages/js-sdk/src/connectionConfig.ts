import { Logger } from './logs'
import { getEnvVar, version } from './api/metadata'
import { InvalidArgumentError } from './errors'

export const REQUEST_TIMEOUT_MS = 60_000 // 60 seconds
export const DEFAULT_SANDBOX_TIMEOUT_MS = 300_000 // 300 seconds
export const MAX_CONCURRENT_FILE_UPLOADS = 8
export const MAX_GLOBAL_CONCURRENT_FILE_UPLOADS = 128
export const FILE_UPLOAD_RETRY_ATTEMPTS = 4
export const KEEPALIVE_PING_INTERVAL_SEC = 50 // 50 seconds

export const KEEPALIVE_PING_HEADER = 'Keepalive-Ping-Interval'

const MAX_CONCURRENT_FILE_UPLOADS_ENV = 'E2B_MAX_CONCURRENT_FILE_UPLOADS'
const MAX_GLOBAL_CONCURRENT_FILE_UPLOADS_ENV =
  'E2B_MAX_GLOBAL_CONCURRENT_FILE_UPLOADS'
const FILE_UPLOAD_RETRY_ATTEMPTS_ENV = 'E2B_FILE_UPLOAD_RETRY_ATTEMPTS'
const INTEGER_STRING_PATTERN = /^[+-]?\d+$/

function getPositiveInteger(
  name: string,
  value: number | string | undefined,
  defaultValue: number
) {
  if (value == undefined || value === '') return defaultValue

  if (typeof value === 'string' && !INTEGER_STRING_PATTERN.test(value)) {
    throw new InvalidArgumentError(`${name} must be a positive integer`)
  }

  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new InvalidArgumentError(`${name} must be a positive integer`)
  }

  return parsed
}

/**
 * Connection options for requests to the API.
 */
export interface ConnectionOpts {
  /**
   * E2B API key to use for authentication.
   *
   * @default E2B_API_KEY // environment variable
   */
  apiKey?: string
  /**
   * E2B access token to use for authentication.
   *
   * @default E2B_ACCESS_TOKEN // environment variable
   */
  accessToken?: string
  /**
   * Domain to use for the API.
   *
   * @default E2B_DOMAIN // environment variable or `e2b.app`
   */
  domain?: string
  /**
   * API Url to use for the API.
   * @internal
   * @default E2B_API_URL // environment variable or `https://api.${domain}`
   */
  apiUrl?: string
  /**
   * Sandbox Url to use for the API.
   * @internal
   * @default E2B_SANDBOX_URL // environment variable or `https://${port}-${sandboxID}.${domain}`
   */
  sandboxUrl?: string
  /**
   * If true the SDK starts in the debug mode and connects to the local envd API server.
   * @internal
   * @default E2B_DEBUG // environment variable or `false`
   */
  debug?: boolean
  /**
   * Timeout for requests to the API in **milliseconds**.
   *
   * @default 60_000 // 60 seconds
   */
  requestTimeoutMs?: number
  /**
   * Maximum number of file uploads to run concurrently for a single write operation.
   *
   * @default E2B_MAX_CONCURRENT_FILE_UPLOADS // environment variable or `8`
   */
  maxConcurrentFileUploads?: number
  /**
   * Maximum number of file uploads to run concurrently across all sandboxes in the current process.
   *
   * @default E2B_MAX_GLOBAL_CONCURRENT_FILE_UPLOADS // environment variable or `128`
   */
  maxGlobalConcurrentFileUploads?: number
  /**
   * Number of attempts for retryable file upload transport failures.
   *
   * @default E2B_FILE_UPLOAD_RETRY_ATTEMPTS // environment variable or `4`
   */
  fileUploadRetryAttempts?: number
  /**
   * Logger to use for logging messages. It can accept any object that implements `Logger` interface—for example, {@link console}.
   */
  logger?: Logger

  /**
   * Additional headers to send with the request.
   */
  headers?: Record<string, string>
}

/**
 * Configuration for connecting to the API.
 */
export class ConnectionConfig {
  public static envdPort = 49983

  readonly debug: boolean
  readonly domain: string
  readonly apiUrl: string
  readonly sandboxUrl?: string
  readonly logger?: Logger

  readonly requestTimeoutMs: number
  readonly maxConcurrentFileUploads: number
  readonly maxGlobalConcurrentFileUploads: number
  readonly fileUploadRetryAttempts: number

  readonly apiKey?: string
  readonly accessToken?: string

  readonly headers?: Record<string, string>

  constructor(opts?: ConnectionOpts) {
    this.apiKey = opts?.apiKey || ConnectionConfig.apiKey
    this.debug = opts?.debug || ConnectionConfig.debug
    this.domain = opts?.domain || ConnectionConfig.domain
    this.accessToken = opts?.accessToken || ConnectionConfig.accessToken
    this.requestTimeoutMs = opts?.requestTimeoutMs ?? REQUEST_TIMEOUT_MS
    this.maxConcurrentFileUploads =
      opts?.maxConcurrentFileUploads !== undefined
        ? getPositiveInteger(
            'maxConcurrentFileUploads',
            opts.maxConcurrentFileUploads,
            MAX_CONCURRENT_FILE_UPLOADS
          )
        : ConnectionConfig.maxConcurrentFileUploads
    this.maxGlobalConcurrentFileUploads =
      opts?.maxGlobalConcurrentFileUploads !== undefined
        ? getPositiveInteger(
            'maxGlobalConcurrentFileUploads',
            opts.maxGlobalConcurrentFileUploads,
            MAX_GLOBAL_CONCURRENT_FILE_UPLOADS
          )
        : ConnectionConfig.maxGlobalConcurrentFileUploads
    this.fileUploadRetryAttempts =
      opts?.fileUploadRetryAttempts !== undefined
        ? getPositiveInteger(
            'fileUploadRetryAttempts',
            opts.fileUploadRetryAttempts,
            FILE_UPLOAD_RETRY_ATTEMPTS
          )
        : ConnectionConfig.fileUploadRetryAttempts
    this.logger = opts?.logger
    this.headers = opts?.headers || {}
    this.headers['User-Agent'] = `e2b-js-sdk/${version}`

    this.apiUrl =
      opts?.apiUrl ||
      ConnectionConfig.apiUrl ||
      (this.debug ? 'http://localhost:3000' : `https://api.${this.domain}`)

    this.sandboxUrl = opts?.sandboxUrl || ConnectionConfig.sandboxUrl
  }

  private static get domain() {
    return getEnvVar('E2B_DOMAIN') || 'e2b.app'
  }

  private static get apiUrl() {
    return getEnvVar('E2B_API_URL')
  }

  private static get sandboxUrl() {
    return getEnvVar('E2B_SANDBOX_URL')
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

  private static get maxConcurrentFileUploads() {
    return getPositiveInteger(
      MAX_CONCURRENT_FILE_UPLOADS_ENV,
      getEnvVar(MAX_CONCURRENT_FILE_UPLOADS_ENV),
      MAX_CONCURRENT_FILE_UPLOADS
    )
  }

  private static get maxGlobalConcurrentFileUploads() {
    return getPositiveInteger(
      MAX_GLOBAL_CONCURRENT_FILE_UPLOADS_ENV,
      getEnvVar(MAX_GLOBAL_CONCURRENT_FILE_UPLOADS_ENV),
      MAX_GLOBAL_CONCURRENT_FILE_UPLOADS
    )
  }

  private static get fileUploadRetryAttempts() {
    return getPositiveInteger(
      FILE_UPLOAD_RETRY_ATTEMPTS_ENV,
      getEnvVar(FILE_UPLOAD_RETRY_ATTEMPTS_ENV),
      FILE_UPLOAD_RETRY_ATTEMPTS
    )
  }

  getSignal(requestTimeoutMs?: number) {
    const timeout = requestTimeoutMs ?? this.requestTimeoutMs

    return timeout ? AbortSignal.timeout(timeout) : undefined
  }

  getSandboxUrl(
    sandboxId: string,
    opts: { sandboxDomain: string; envdPort: number }
  ) {
    if (this.sandboxUrl) {
      return this.sandboxUrl
    }

    return `${this.debug ? 'http' : 'https'}://${this.getHost(sandboxId, opts.envdPort, opts.sandboxDomain)}`
  }

  getHost(sandboxId: string, port: number, sandboxDomain: string) {
    if (this.debug) {
      return `localhost:${port}`
    }

    return `${port}-${sandboxId}.${sandboxDomain ?? this.domain}`
  }
}

/**
 * User used for the operation in the sandbox.
 */

export const defaultUsername: Username = 'user'
export type Username = string
