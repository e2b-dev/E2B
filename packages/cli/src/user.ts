import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'

/**
 * User configuration stored in ~/.e2b/config.json
 */
export interface UserConfig {
  email: string
  accessToken: string
  teamName: string
  teamId: string
  teamApiKey: string
  dockerProxySet?: boolean
}

export const USER_CONFIG_PATH = path.join(os.homedir(), '.e2b', 'config.json') // TODO: Keep in Keychain

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
  return JSON.parse(fs.readFileSync(USER_CONFIG_PATH, 'utf8'))
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
