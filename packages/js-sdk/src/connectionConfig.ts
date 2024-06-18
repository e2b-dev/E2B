import { Logger } from './logs'

export const DOMAIN = process?.env?.E2B_DOMAIN || 'e2b.dev'
const DEBUG = (process?.env?.E2B_DEBUG || 'false').toLowerCase() === 'true'
const API_KEY = process?.env?.E2B_API_KEY
const ACCESS_TOKEN = process?.env?.E2B_ACCESS_TOKEN
const REQUEST_TIMEOUT_MS = 30_000  // 30s
export const KEEPALIVE_INTERVAL = 60_000 // 1m

export interface ConnectionOpts {
  apiKey?: string
  accessToken?: string
  domain?: string
  debug?: boolean
  requestTimeoutMs?: number
  logger?: Logger
}

// function handleError(err: Error) {
//   if (err instanceof ConnectError) {
//     switch (err.code) {
//       case Code.InvalidArgument:
//         return new InvalidUserError(err.message)
//       case Code.NotFound:
//         return new InvalidPathError(err.message)
//       case Code.DeadlineExceeded:
//         return new TimeoutError(err.message)
//       case Code.Canceled:
//         return new TimeoutError(err.message)
//       default:
//         return new FilesystemError(err.message)
//     }
//   }
//   throw err


// }


export class SandboxError extends Error {
  constructor(message: any) {
    super(message)
    this.name = 'SandboxError'
  }
}

// [canceled] is caused by exceeding request timeout
// [deadline_exceeded] is caused by exceeding the timeout (for process handlers, watch, etc)
export class TimeoutError extends SandboxError {
  constructor(message: string) {
    super(message)
    this.name = 'TimeoutError'
  }
}

export class InvalidUserError extends SandboxError {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidUsernameError'
  }
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
    this.apiKey = opts?.apiKey || API_KEY
    this.debug = opts?.debug || DEBUG
    this.domain = opts?.domain || DOMAIN
    this.accessToken = opts?.accessToken || ACCESS_TOKEN
    this.requestTimeoutMs = opts?.requestTimeoutMs ?? REQUEST_TIMEOUT_MS
    this.logger = opts?.logger

    this.apiUrl = this.debug ? 'http://localhost:3000' : `https://api.${this.domain}`
  }

  getSignal(requestTimeoutMs?: number) {
    const timeout = requestTimeoutMs ?? this.requestTimeoutMs

    return timeout ? AbortSignal.timeout(timeout) : undefined
  }
}

export type Username = 'root' | 'user'

export const defaultUsername: Username = 'user'
