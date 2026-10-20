// X-E2B-Alt-Used identifies a key's control plane; apiUrl eligibility preserves rebuilt custom-proxy configs.
export const ALT_USED_HEADER = 'X-E2B-Alt-Used'

const resolvedDomains = new Map<string, string>()
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
  return !debug && apiUrl === `https://api.${domain}`
}

export function clearResolvedDomains() {
  resolvedDomains.clear()
}
