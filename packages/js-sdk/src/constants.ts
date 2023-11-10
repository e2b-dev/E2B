export const SANDBOX_REFRESH_PERIOD = 5_000 // 5s
export const WS_RECONNECT_INTERVAL = 600 // 600ms

export const TIMEOUT = 60_000 // 60s

export const API_DOMAIN = 'api.e2b.dev'
export const API_HOST = process?.env?.E2B_DEBUG
  ? 'http://localhost:3000'
  : `https://${API_DOMAIN}`
export const SANDBOX_DOMAIN = 'e2b.dev'

export const ENVD_PORT = 49982
export const WS_ROUTE = '/ws'

export const FILE_ROUTE = '/file'
