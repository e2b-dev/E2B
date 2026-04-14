import { ProxyAgent } from 'undici'

import { getEnvVar } from './api/metadata'
import { runtime } from './utils'

function getProxyUrl(): string | undefined {
  return (
    getEnvVar('https_proxy') ||
    getEnvVar('HTTPS_PROXY') ||
    getEnvVar('http_proxy') ||
    getEnvVar('HTTP_PROXY') ||
    getEnvVar('all_proxy') ||
    getEnvVar('ALL_PROXY') ||
    undefined
  )
}

let cachedProxyFetch: typeof fetch | null = null
let proxyResolved = false

/**
 * Returns a proxy-aware fetch function if HTTPS_PROXY/HTTP_PROXY/ALL_PROXY
 * env vars are set. In browser environments, returns undefined (browsers
 * handle proxies natively via OS settings).
 *
 * Uses undici's ProxyAgent.
 */
export function getProxyFetch(): typeof fetch | undefined {
  if (proxyResolved) return cachedProxyFetch ?? undefined
  proxyResolved = true

  if (runtime === 'browser') return undefined

  const proxyUrl = getProxyUrl()
  if (!proxyUrl) return undefined

  const agent = new ProxyAgent(proxyUrl)
  cachedProxyFetch = ((input: any, init?: any) =>
    fetch(input, { ...init, dispatcher: agent })) as typeof fetch
  return cachedProxyFetch
}
