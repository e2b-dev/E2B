export const DEBUG = (process?.env?.E2B_DEBUG || 'false').toLowerCase() === 'true'
export const DOMAIN = process?.env?.E2B_DOMAIN || 'e2b.dev'
export const API_DOMAIN = DEBUG ? 'localhost:3000' : `api.${DOMAIN}`
export const API_HOST = `${DEBUG ? 'http' : 'https'}://${API_DOMAIN}`

export const RPC_PORT = 49982

export const FILE_ROUTE = '/file'