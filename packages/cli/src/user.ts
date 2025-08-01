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

  /**
   * @deprecated Kept for backward compatibility. Use {@link UserConfig.teamApiKey} instead.
   */
  defaultTeamApiKey?: string

  /**
   * @deprecated Kept for backward compatibility. Use {@link UserConfig.teamId} instead.
   */
  defaultTeamId?: string
}

export const USER_CONFIG_PATH = path.join(os.homedir(), '.e2b', 'config.json') // TODO: Keep in Keychain
export const DOCS_BASE =
  process.env.E2B_DOCS_BASE ||
  `https://${process.env.E2B_DOMAIN || 'e2b.dev'}/docs`
export const SANDBOX_INSPECT_URL = (teamId: string, sandboxId: string) =>
  `https://${
    process.env.E2B_DOMAIN || 'e2b.dev'
  }/dashboard/${teamId}/sandboxes/${sandboxId}/inspect`

export function getUserConfig(): UserConfig | null {
  if (!fs.existsSync(USER_CONFIG_PATH)) return null
  return JSON.parse(fs.readFileSync(USER_CONFIG_PATH, 'utf8'))
}
