import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import { z } from 'zod'

const authFields = {
  identity: z.object({ email: z.string() }),
  oauth: z.object({
    token_endpoint: z.string(),
    revoke_endpoint: z.string(),
    client_id: z.string(),
  }),
  tokens: z.object({ access_token: z.string(), refresh_token: z.string() }),
  // Never checked by earlier CLI versions: a bad value must not sign users out.
  last_refresh: z.string().optional().catch(undefined),
  dockerProxySet: z.boolean().optional().catch(undefined),
}

/**
 * User configuration stored in ~/.e2b/config.json
 */
const userConfigSchema = z.object({
  version: z.literal(2),
  ...authFields,
  projectName: z.string(),
  projectId: z.string(),
  // Stored by earlier CLI versions, which authenticate with it. Not used for
  // requests any more, but kept on disk so those versions stay signed in.
  projectApiKey: z.string().optional(),
})

export type UserConfig = z.infer<typeof userConfigSchema>

/** The pre-project config format, with team* instead of project* fields. */
const v1UserConfigSchema = z.object({
  version: z.literal(1),
  ...authFields,
  teamName: z.string(),
  teamId: z.string(),
})

export const USER_CONFIG_PATH = path.join(os.homedir(), '.e2b', 'config.json') // TODO: Keep in Keychain

export const DEPRECATED_USER_CONFIG_MESSAGE =
  'Your CLI authentication config is deprecated. You have been signed out. Please run `e2b auth login` again.'

// getUserConfig can be called several times per command; warn only once.
let deprecationWarned = false

/** Browser sign-in page for `e2b auth login`. */
export const CLI_AUTH_URL = `https://${process.env.E2B_DOMAIN || 'e2b.dev'}/auth/cli`

const DASHBOARD_BASE =
  process.env.E2B_DASHBOARD_BASE ||
  `https://${process.env.E2B_DOMAIN || 'e2b.dev'}/dashboard`

export const SANDBOX_INSPECT_URL = (sandboxId: string) =>
  `${DASHBOARD_BASE}/inspect/sandbox/${sandboxId}`

export function getUserConfig(): UserConfig | null {
  if (!fs.existsSync(USER_CONFIG_PATH)) return null
  const config = JSON.parse(fs.readFileSync(USER_CONFIG_PATH, 'utf8'))

  // v1 configs are migrated in memory only — the file on disk is left
  // untouched so older CLI versions keep working; the v2 format is only
  // persisted when the config is written anyway (login, configure,
  // token refresh).
  const migrated = migrateV1UserConfig(config)
  if (migrated) return migrated

  // An unrecognized config is treated as being signed out, but the file is
  // kept on disk — `e2b auth login` overwrites it.
  if (!userConfigSchema.safeParse(config).success) {
    if (!deprecationWarned) {
      deprecationWarned = true
      console.error(DEPRECATED_USER_CONFIG_MESSAGE)
    }
    return null
  }

  // Return the original object, not the parsed one, so fields this CLI
  // version doesn't know about are kept when the config is written back.
  return config as UserConfig
}

/**
 * Convert a v1 config (team* fields) to the v2 format (project* fields).
 * Returns null if the config is not a valid v1 config.
 */
function migrateV1UserConfig(config: unknown): UserConfig | null {
  if (!v1UserConfigSchema.safeParse(config).success) return null

  // Spread the original object, not the parsed one, so fields this CLI
  // version doesn't know about are kept when the config is written back.
  const { teamName, teamId, teamApiKey, ...rest } = config as z.infer<
    typeof v1UserConfigSchema
  > & { teamApiKey?: string }
  return {
    ...rest,
    version: 2,
    projectName: teamName,
    projectId: teamId,
    // Requests use the access token, but the key is kept so CLI versions that
    // still authenticate with it stay signed in.
    ...(teamApiKey ? { projectApiKey: teamApiKey } : {}),
  }
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
  // Requests use the access token, but a stored `projectApiKey` is written
  // back unchanged so CLI versions that still authenticate with it stay
  // signed in.
  const persisted: Record<string, unknown> = { ...config }

  const dir = path.dirname(configPath)
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  fs.chmodSync(dir, 0o700)
  // Write to a temporary file and rename it over the config, so other e2b
  // processes reading it (token refreshes happen in the background of any
  // command) never see a partially written file.
  const tmpPath = `${configPath}.${process.pid}.tmp`
  fs.writeFileSync(tmpPath, JSON.stringify(persisted, null, 2), {
    mode: 0o600,
  })
  fs.chmodSync(tmpPath, 0o600)
  fs.renameSync(tmpPath, configPath)
}
