import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'

export interface UserConfig {
  email: string
  accessToken: string
  defaultTeamApiKey: string
  defaultTeamId: string
}

export const USER_CONFIG_PATH = path.join(os.homedir(), '.e2b', 'config.json') // TODO: Keep in Keychain
export const DOCS_BASE = process.env.E2B_DOCS_BASE || 'https://e2b.dev/docs'

export function getUserConfig(): UserConfig | null {
  if (!fs.existsSync(USER_CONFIG_PATH)) return null
  return JSON.parse(fs.readFileSync(USER_CONFIG_PATH, 'utf8'))
}
