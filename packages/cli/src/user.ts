import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'

/**
 * User configuration stored in ~/.e2b/config.json
 */
export interface UserIdentity {
  email: string
}

export interface UserOAuth {
  token_endpoint: string
  revoke_endpoint: string
  client_id: string
}

export interface UserTokens {
  access_token: string
  refresh_token: string
}

export interface UserConfig {
  version: 1
  identity: UserIdentity
  oauth: UserOAuth
  tokens: UserTokens
  last_refresh: string
  teamName: string
  teamId: string
  teamApiKey: string
  dockerProxySet?: boolean
}

type UnknownRecord = Record<string, unknown>

export const USER_CONFIG_PATH = path.join(os.homedir(), '.e2b', 'config.json') // TODO: Keep in Keychain

export const DEPRECATED_USER_CONFIG_MESSAGE =
  'Your CLI authentication config is deprecated. You have been signed out. Please run `e2b auth login` again.'

export const DOCS_BASE =
  process.env.E2B_DOCS_BASE ||
  `https://${process.env.E2B_DOMAIN || 'e2b.dev'}/docs`

export const DASHBOARD_BASE =
  process.env.E2B_DASHBOARD_BASE ||
  `https://${process.env.E2B_DOMAIN || 'e2b.dev'}/dashboard`

export const SANDBOX_INSPECT_URL = (sandboxId: string) =>
  `${DASHBOARD_BASE}/inspect/sandbox/${sandboxId}`

export function getUserConfig(): UserConfig | null {
  if (!fs.existsSync(USER_CONFIG_PATH)) return null
  const config = JSON.parse(fs.readFileSync(USER_CONFIG_PATH, 'utf8'))

  if (!isUserConfig(config)) {
    fs.unlinkSync(USER_CONFIG_PATH)
    console.error(DEPRECATED_USER_CONFIG_MESSAGE)
    return null
  }

  return config
}

function isObject(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isUserConfig(config: unknown): config is UserConfig {
  if (!isObject(config)) return false
  if (config.version !== 1) return false
  return (
    isObject(config.identity) &&
    isString(config.identity.email) &&
    isObject(config.oauth) &&
    isString(config.oauth.token_endpoint) &&
    isString(config.oauth.revoke_endpoint) &&
    isString(config.oauth.client_id) &&
    isObject(config.tokens) &&
    isString(config.tokens.access_token) &&
    isString(config.tokens.refresh_token)
  )
}

export function getConfigRefreshTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Write user config to disk with restrictive file permissions.
 * The config directory is restricted to the owner and the config file is
 * written as owner-readable/writable only because it contains credentials.
 */
export function writeUserConfig(configPath: string, config: UserConfig): void {
  const dir = path.dirname(configPath)
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  fs.chmodSync(dir, 0o700)
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 })
  fs.chmodSync(configPath, 0o600)
}
