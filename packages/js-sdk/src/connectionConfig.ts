import { AuthenticationError } from './sandbox/errors'

const DOMAIN = process?.env?.E2B_DOMAIN || 'e2b.dev'
const DEBUG = (process?.env?.E2B_DEBUG || 'false').toLowerCase() === 'true'
const API_KEY = process?.env?.E2B_API_KEY

export interface ConnectionOpts {
  apiKey?: string
  domain?: string
  debug?: boolean
}

export class ConnectionConfig {
  readonly debug: boolean
  readonly domain: string
  readonly apiUrl: string

  private readonly _apiKey?: string

  constructor(opts: ConnectionOpts) {
    this._apiKey = opts.apiKey || API_KEY
    this.debug = opts.debug || DEBUG
    this.domain = opts.domain || DOMAIN

    this.apiUrl = this.debug ? 'http://localhost:3000' : `https://api.${this.domain}`
  }

  get apiKey() {
    if (!this._apiKey) {
      throw new AuthenticationError(
        'API key is required, please visit https://e2b.dev/docs to get your API key. ' +
        'You can either set the environment variable `E2B_API_KEY` ' +
        "or you can pass it directly to the sandbox like Sandbox.create({ apiKey: 'e2b_...' })",
      )
    }

    return this._apiKey
  }
}
