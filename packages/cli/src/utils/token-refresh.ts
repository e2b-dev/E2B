import * as fs from 'fs'

import {
  getUserConfig,
  writeUserConfig,
  USER_CONFIG_PATH,
  UserConfig,
} from 'src/user'
import { withFileLock } from './lock'

const REFRESH_SKEW_SECONDS = 60

const REFRESH_TIMEOUT_MS = 15_000

/** Serializes writes to the user config across e2b processes. */
const CONFIG_LOCK = {
  // Longer than a refresh can take (REFRESH_TIMEOUT_MS), so a live holder's
  // lock is never treated as stale.
  staleMs: 30_000,
  timeoutMs: 45_000,
}

/** The `exp` claim of a JWT, or `undefined` for anything else. */
export function decodeJwtExp(token: string): number | undefined {
  const payload = token.split('.')[1]
  if (!payload) return undefined
  try {
    const decoded = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as { exp?: number }
    return decoded.exp
  } catch {
    return undefined
  }
}

function isTokenExpired(accessToken: string): boolean {
  const exp = decodeJwtExp(accessToken)
  if (!exp) return true
  return Math.floor(Date.now() / 1000) >= exp - REFRESH_SKEW_SECONDS
}

class TokenRefreshError extends Error {
  constructor(
    public status: number,
    public errorCode: string,
    message: string
  ) {
    super(message)
    this.name = 'TokenRefreshError'
  }
}

type RefreshedTokens = {
  access_token: string
  refresh_token: string
}

async function refreshOAuthToken(
  refreshToken: string,
  clientId: string,
  tokenEndpoint: string
): Promise<RefreshedTokens> {
  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as Record<string, unknown>)
    throw new TokenRefreshError(
      res.status,
      (body.error as string) ?? 'unknown',
      (body.error_description as string) ?? 'Token refresh failed'
    )
  }

  const data = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in: number
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? refreshToken,
  }
}

/**
 * Return a valid access token for the logged-in user, refreshing it first if
 * it expires within a minute, along with the config it belongs to.
 *
 * Refresh tokens rotate: once used, the old one is rejected. Refreshing is
 * therefore serialized across CLI processes with a lock file, and the config
 * is re-read under the lock so a process that waited picks up the tokens the
 * other one just wrote instead of spending the rotated refresh token.
 */
export async function ensureValidAccessToken(): Promise<{
  accessToken: string
  config: UserConfig
}> {
  const current = getUserConfig()
  if (!current) {
    throw new Error('No user config found, run `e2b auth login` first.')
  }
  if (!isTokenExpired(current.tokens.access_token)) {
    return { accessToken: current.tokens.access_token, config: current }
  }

  return withFileLock(
    USER_CONFIG_PATH,
    async () => {
      const config = getUserConfig()
      if (!config) {
        throw new Error('No user config found, run `e2b auth login` first.')
      }
      if (!isTokenExpired(config.tokens.access_token)) {
        return { accessToken: config.tokens.access_token, config }
      }

      let refreshed: RefreshedTokens
      try {
        refreshed = await refreshOAuthToken(
          config.tokens.refresh_token,
          config.oauth.client_id,
          config.oauth.token_endpoint
        )
      } catch (err) {
        if (
          err instanceof TokenRefreshError &&
          err.errorCode === 'invalid_grant'
        ) {
          fs.rmSync(USER_CONFIG_PATH, { force: true })
          throw new Error(
            'Your session has expired. Please run `e2b auth login` again.'
          )
        }
        throw err
      }

      // Token refresh updates only tokens.* — it does NOT update last_refresh.
      const updated = { ...config, tokens: refreshed }
      writeUserConfig(USER_CONFIG_PATH, updated)

      return { accessToken: refreshed.access_token, config: updated }
    },
    CONFIG_LOCK
  )
}

/**
 * Apply `patch` to the stored config under the config lock, so it can't
 * revert tokens another e2b process refreshes at the same time. A function
 * gets the config as it is under the lock, which may differ from the one
 * the caller read.
 */
export async function updateUserConfig(
  patch: Partial<UserConfig> | ((config: UserConfig) => Partial<UserConfig>)
): Promise<UserConfig> {
  return withFileLock(
    USER_CONFIG_PATH,
    () => {
      const config = getUserConfig()
      if (!config) {
        throw new Error('No user config found, run `e2b auth login` first.')
      }
      const updated = {
        ...config,
        ...(typeof patch === 'function' ? patch(config) : patch),
      }
      writeUserConfig(USER_CONFIG_PATH, updated)
      return updated
    },
    CONFIG_LOCK
  )
}
