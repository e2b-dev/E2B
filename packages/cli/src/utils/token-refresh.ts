import * as fs from 'fs'
import * as path from 'path'

import {
  getUserConfig,
  writeUserConfig,
  USER_CONFIG_PATH,
  UserConfig,
} from 'src/user'
import { wait } from './wait'

const REFRESH_SKEW_SECONDS = 60

const LOCK_PATH = `${USER_CONFIG_PATH}.lock`
// Longer than a refresh can take (REFRESH_TIMEOUT_MS), so a live holder's lock
// is never treated as stale; a crashed holder's is cleared after this long.
const LOCK_STALE_MS = 30_000
const LOCK_WAIT_MS = 45_000
const REFRESH_TIMEOUT_MS = 15_000

function decodeJwtExp(token: string): number | undefined {
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
 * Take the cross-process refresh lock, waiting for another holder to finish.
 * Returns a function that releases it.
 */
async function acquireRefreshLock(): Promise<() => void> {
  fs.mkdirSync(path.dirname(LOCK_PATH), { recursive: true, mode: 0o700 })
  const deadline = Date.now() + LOCK_WAIT_MS

  for (;;) {
    try {
      fs.closeSync(fs.openSync(LOCK_PATH, 'wx', 0o600))
      return () => fs.rmSync(LOCK_PATH, { force: true })
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
    }

    const lockAgeMs =
      Date.now() -
      (fs.statSync(LOCK_PATH, { throwIfNoEntry: false })?.mtimeMs ?? Date.now())
    if (lockAgeMs > LOCK_STALE_MS) {
      fs.rmSync(LOCK_PATH, { force: true })
      continue
    }
    if (Date.now() > deadline) {
      throw new Error(
        `Timed out waiting for another e2b process to refresh your credentials. If none is running, delete ${LOCK_PATH} and try again.`
      )
    }
    await wait(100)
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

  const release = await acquireRefreshLock()
  try {
    const config = getUserConfig()
    if (!config) {
      throw new Error('No user config found, run `e2b auth login` first.')
    }
    if (!isTokenExpired(config.tokens.access_token)) {
      return { accessToken: config.tokens.access_token, config }
    }

    const refreshed = await refreshOAuthToken(
      config.tokens.refresh_token,
      config.oauth.client_id,
      config.oauth.token_endpoint
    )

    // Token refresh updates only tokens.* — it does NOT update last_refresh.
    const updated = { ...config, tokens: refreshed }
    writeUserConfig(USER_CONFIG_PATH, updated)

    return { accessToken: refreshed.access_token, config: updated }
  } catch (err) {
    if (err instanceof TokenRefreshError && err.errorCode === 'invalid_grant') {
      fs.rmSync(USER_CONFIG_PATH, { force: true })
      throw new Error(
        'Your session has expired. Please run `e2b auth login` again.'
      )
    }
    throw err
  } finally {
    release()
  }
}
