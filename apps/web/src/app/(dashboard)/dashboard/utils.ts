export function getBaseUrl(domain: string) {
  let url = domain
  if (!domain.startsWith('http')) {
    const local = domain === 'localhost' || domain.startsWith('127.0.0.')
    url = `http${local ? '' : 's'}://${domain}`
  }

  const parsedUrl = new URL(url)

  return parsedUrl.toString()
}

export function getBillingUrl(domain: string) {
  let url = domain
  const local = domain === 'localhost' || domain.startsWith('127.0.0.')

  if (!domain.startsWith('http')) {
    url = `http${local ? '' : 's'}://${domain}`
  }

  const parsedUrl = new URL(url)
  if (!local) {
    parsedUrl.hostname = `billing.${parsedUrl.hostname}`
  }

  return parsedUrl.toString()
}
