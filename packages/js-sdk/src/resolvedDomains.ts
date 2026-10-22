// The global API proxy names the control plane for an API key in
// X-E2B-Alt-Used; later configs use it directly. Eligibility compares apiUrl
// because rebuilt configs carry it, and discovery is disabled when any of
// E2B_DOMAIN, E2B_API_URL, E2B_SANDBOX_URL, or E2B_VOLUME_API_URL is set.
import { getEnvVar } from './api/metadata'

export const ALT_USED_HEADER = 'X-E2B-Alt-Used'

const resolvedDomains = new Map<string, string>()
const PINNED_ENV_VARS = [
  'E2B_DOMAIN',
  'E2B_API_URL',
  'E2B_SANDBOX_URL',
  'E2B_VOLUME_API_URL',
]
const hostnamePattern =
  /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/

function cacheKey(domain: string, apiKey?: string) {
  return JSON.stringify([domain, apiKey ?? ''])
}

export function getResolvedDomain(
  domain: string,
  apiKey?: string
): string | undefined {
  return resolvedDomains.get(cacheKey(domain, apiKey))
}

export function recordResolvedDomain(
  domain: string,
  apiKey: string | undefined,
  value: string | null | undefined
) {
  const resolved = value?.trim().toLowerCase()
  if (!resolved || !hostnamePattern.test(resolved) || resolved === domain) {
    return
  }

  resolvedDomains.set(cacheKey(domain, apiKey), resolved)
}

export function usesDomainApiUrl(
  domain: string,
  apiUrl: string,
  debug: boolean
): boolean {
  return (
    !debug &&
    !PINNED_ENV_VARS.some((name) => getEnvVar(name)) &&
    apiUrl === `https://api.${domain}`
  )
}

export function clearResolvedDomains() {
  resolvedDomains.clear()
}
