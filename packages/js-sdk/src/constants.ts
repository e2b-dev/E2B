export const SANDBOX_REFRESH_PERIOD = 5_000 // 5s
export const WS_RECONNECT_INTERVAL = 600 // 600ms

export const TIMEOUT = 60_000 // 60s

const DEBUG = process?.env?.E2B_DEBUG
const DOMAIN = process?.env?.E2B_DOMAIN || 'e2b.dev'
export const SECURE = DEBUG ? false : (process?.env?.E2B_SECURE || 'true').toLowerCase() === 'true'
export const API_DOMAIN = DEBUG ? 'localhost:3000' : `api.${DOMAIN}`
export const API_HOST = `${SECURE ? 'https' : 'http'}://${API_DOMAIN}`
export const SANDBOX_DOMAIN = DEBUG ? 'localhost:3000' : DOMAIN

export const ENVD_PORT = 49982
export const WS_ROUTE = '/ws'

export const FILE_ROUTE = '/file'
