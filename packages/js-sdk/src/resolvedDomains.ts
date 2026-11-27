// The API proxy reports the control-plane host in X-E2B-Alt-Used; discovery is
// cached per API key and only runs when domain, apiUrl, and sandboxUrl are unset
// and debug is off.

export const ALT_USED_HEADER = 'X-E2B-Alt-Used'

const resolvedDomains = new Map<string, string>()
const hostnamePattern =
  /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/

function cacheKey(apiKey?: string) {
  return apiKey ?? ''
}

export function getResolvedDomain(apiKey?: string): string | undefined {
  return resolvedDomains.get(cacheKey(apiKey))
}

export function recordResolvedDomain(
  apiKey: string | undefined,
  value: string | null | undefined
) {
  const resolved = value?.trim().toLowerCase()
  if (!resolved || !hostnamePattern.test(resolved)) {
    return
  }

  resolvedDomains.set(cacheKey(apiKey), resolved)
}

export function clearResolvedDomains() {
  resolvedDomains.clear()
}
