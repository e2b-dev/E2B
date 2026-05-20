import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import * as toml from '@iarna/toml'

export interface UserConfig {
  email?: string
  accessToken?: string
  teamName?: string
  teamId?: string
  teamApiKey?: string
  domain?: string
  dockerProxySet?: boolean
}

// New extensionless TOML config (~/.e2b/config)
export const USER_CONFIG_TOML_PATH = path.join(os.homedir(), '.e2b', 'config')
// Legacy JSON config kept for read-only fallback
export const USER_CONFIG_PATH = path.join(os.homedir(), '.e2b', 'config.json')

export const DOCS_BASE =
  process.env.E2B_DOCS_BASE ||
  `https://${process.env.E2B_DOMAIN || 'e2b.dev'}/docs`

export const DASHBOARD_BASE =
  process.env.E2B_DASHBOARD_BASE ||
  `https://${process.env.E2B_DOMAIN || 'e2b.dev'}/dashboard`

export const SANDBOX_INSPECT_URL = (sandboxId: string) =>
  `${DASHBOARD_BASE}/inspect/sandbox/${sandboxId}`

function fromTomlProfile(profile: toml.JsonMap): UserConfig {
  return {
    email: profile['email'] as string | undefined,
    accessToken: profile['access_token'] as string | undefined,
    teamName: profile['team_name'] as string | undefined,
    teamId: profile['team_id'] as string | undefined,
    teamApiKey: profile['api_key'] as string | undefined,
    domain: profile['domain'] as string | undefined,
    dockerProxySet: profile['docker_proxy_set'] as boolean | undefined,
  }
}

function toTomlProfile(config: UserConfig): toml.JsonMap {
  const profile: toml.JsonMap = {}
  if (config.email !== undefined) profile['email'] = config.email
  if (config.accessToken !== undefined)
    profile['access_token'] = config.accessToken
  if (config.teamName !== undefined) profile['team_name'] = config.teamName
  if (config.teamId !== undefined) profile['team_id'] = config.teamId
  if (config.teamApiKey !== undefined) profile['api_key'] = config.teamApiKey
  if (config.domain !== undefined) profile['domain'] = config.domain
  if (config.dockerProxySet !== undefined)
    profile['docker_proxy_set'] = config.dockerProxySet
  return profile
}

export function getUserConfig(
  profileName: string = 'default'
): UserConfig | null {
  if (fs.existsSync(USER_CONFIG_TOML_PATH)) {
    const raw = fs.readFileSync(USER_CONFIG_TOML_PATH, 'utf8')
    const parsed = toml.parse(raw) as any
    const profile = parsed?.profiles?.[profileName]
    if (!profile) return null
    return fromTomlProfile(profile)
  }

  // Fall back to legacy JSON (treated as the default profile)
  if (profileName === 'default' && fs.existsSync(USER_CONFIG_PATH)) {
    const json = JSON.parse(fs.readFileSync(USER_CONFIG_PATH, 'utf8'))
    return {
      email: json.email,
      accessToken: json.accessToken,
      teamName: json.teamName,
      teamId: json.teamId,
      teamApiKey: json.teamApiKey,
      dockerProxySet: json.dockerProxySet,
    }
  }

  return null
}

export function saveUserConfig(
  config: UserConfig,
  profileName: string = 'default'
): void {
  let existing: any = { profiles: {} }

  if (fs.existsSync(USER_CONFIG_TOML_PATH)) {
    existing = toml.parse(fs.readFileSync(USER_CONFIG_TOML_PATH, 'utf8'))
  } else if (fs.existsSync(USER_CONFIG_PATH)) {
    // Migrate existing JSON into TOML as the default profile
    const json = JSON.parse(fs.readFileSync(USER_CONFIG_PATH, 'utf8'))
    existing.profiles['default'] = toTomlProfile({
      email: json.email,
      accessToken: json.accessToken,
      teamName: json.teamName,
      teamId: json.teamId,
      teamApiKey: json.teamApiKey,
      dockerProxySet: json.dockerProxySet,
    })
  }

  if (!existing.profiles) existing.profiles = {}
  existing.profiles[profileName] = toTomlProfile(config)

  fs.mkdirSync(path.dirname(USER_CONFIG_TOML_PATH), { recursive: true })
  fs.writeFileSync(USER_CONFIG_TOML_PATH, toml.stringify(existing))
}

export function deleteUserProfile(profileName: string = 'default'): void {
  if (fs.existsSync(USER_CONFIG_TOML_PATH)) {
    const raw = fs.readFileSync(USER_CONFIG_TOML_PATH, 'utf8')
    const parsed = toml.parse(raw) as any
    if (parsed?.profiles?.[profileName]) {
      delete parsed.profiles[profileName]
      if (Object.keys(parsed.profiles).length === 0) {
        fs.unlinkSync(USER_CONFIG_TOML_PATH)
      } else {
        fs.writeFileSync(USER_CONFIG_TOML_PATH, toml.stringify(parsed))
      }
    }
  }

  // Always clean up legacy JSON on default profile logout
  if (profileName === 'default' && fs.existsSync(USER_CONFIG_PATH)) {
    fs.unlinkSync(USER_CONFIG_PATH)
  }
}
