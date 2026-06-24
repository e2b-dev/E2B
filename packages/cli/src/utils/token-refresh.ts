import * as fs from 'fs'

import { getUserConfig, writeUserConfig, USER_CONFIG_PATH } from 'src/user'

const REFRESH_SKEW_SECONDS = 60

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

export function isTokenExpired(accessToken: string): boolean {
  const exp = decodeJwtExp(accessToken)
  if (!exp) return true
  return Math.floor(Date.now() / 1000) >= exp - REFRESH_SKEW_SECONDS
}

export class TokenRefreshError extends Error {
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

export async function refreshHydraToken(
  refreshToken: string,
  clientId: string,
  tokenEndpoint: string
): Promise<RefreshedTokens> {
  const res = await fetch(tokenEndpoint, {
    method: 'POST',
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

export async function ensureValidAccessToken(): Promise<string> {
  const config = getUserConfig()
  if (!config) {
    throw new Error('No user config found, run `e2b auth login` first.')
  }

  if (!isTokenExpired(config.tokens.access_token)) {
    return config.tokens.access_token
  }

  try {
    const refreshed = await refreshHydraToken(
      config.tokens.refresh_token,
      config.oauth.client_id,
      config.oauth.token_endpoint
    )

    // Token refresh updates only tokens.* — it does NOT update last_refresh.
    writeUserConfig(USER_CONFIG_PATH, {
      ...config,
      tokens: {
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
      },
    })

    return refreshed.access_token
  } catch (err) {
    if (err instanceof TokenRefreshError && err.errorCode === 'invalid_grant') {
      fs.rmSync(USER_CONFIG_PATH, { force: true })
      throw new Error(
        'Your session has expired. Please run `e2b auth login` again.'
      )
    }
    throw err
  }
}
