import { Code, ConnectError } from '@connectrpc/connect'
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

export function handleApiError(err?: { code: number, message: string }) {
  if (!err) {
    return
  }

  return new SandboxError(`${err.code}: ${err.message}`)
}

// This is the message for the sandbox timeout error when the response code is 502/Unavailable
function formatSandboxTimeoutError(message: string) {
  return new TimeoutError(
    `${message}: This error is likely due to sandbox timeout. You can modify the sandbox timeout by passing 'timeoutMs' when starting the sandbox or calling '.setTimeout' on the sandbox with the desired timeout.`,
  )
}

export function handleEnvdApiError(err: {
  code: number;
  message: string;
} | undefined) {
  switch (err?.code) {
    case 400:
      return new InvalidUserError(err.message)
    case 403:
      return new InvalidPathError(err.message)
    case 404:
      return new NotFoundError(err.message)
    case 502:
      return formatSandboxTimeoutError(err.message)
    case 507:
      return new NotEnoughDiskSpaceError(err.message)
    default:
      if (err) {
        return new SandboxError(`${err.code}: ${err.message}`)
      }
  }
}

export function handleRpcError(err: unknown) {
  if (err instanceof ConnectError) {
    switch (err.code) {
      case Code.InvalidArgument:
        return new InvalidUserError(err.message)
      case Code.NotFound:
        return new InvalidPathError(err.message)
      case Code.Unavailable:
        return formatSandboxTimeoutError(err.message)
      case Code.Canceled:
        return new TimeoutError(
          `${err.message}: This error is likely due to exceeding 'requestTimeoutMs'. You can pass the request timeout value as an option when making the request.`,
        )
      case Code.DeadlineExceeded:
        return new TimeoutError(
          `${err.message}: This error is likely due to exceeding 'timeoutMs' — the total time a long running request can be active. It can be modified by passing 'timeoutMs' when making the request. Use '0' to disable the timeout.`,
        )
      default:
        return new SandboxError(`${err.code}: ${err.message}`)
    }
  }

  return err
}

export class SandboxError extends Error {
  constructor(message: any) {
    super(message)
    this.name = 'SandboxError'
  }
}

// [unknown] is sometimes caused by the sandbox timeout when the request is not processed
// [unavailable] is caused by sandbox timeout
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
    this.name = 'InvalidUserError'
  }
}

export class InvalidPathError extends SandboxError {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidPathError'
  }
}

export class NotEnoughDiskSpaceError extends SandboxError {
  constructor(message: string) {
    super(message)
    this.name = 'NotEnoughDiskSpaceError'
  }
}

export class NotFoundError extends SandboxError {
  constructor(message: string) {
    super(message)
    this.name = 'NotFoundError'
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
