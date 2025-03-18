function getUrl(domain: string, subdomain: string, path: string) {
  let url = domain
  const local = domain.startsWith('localhost') || domain.startsWith('127.0.0.')

  if (!domain.startsWith('http')) {
    url = `http${local ? '' : 's'}://${domain}`
  }

  const parsedUrl = new URL(url)

  if (path) {
    const decodedUrl = decodeURIComponent(path)
    const [pathname, queryString] = decodedUrl.split('?')
    parsedUrl.pathname = pathname
    if (queryString) parsedUrl.search = queryString
  }

  if (!local) {
    parsedUrl.hostname = `${subdomain}.${parsedUrl.hostname}`
  }

  return parsedUrl.toString()
}

export function getAPIUrl(domain: string, path: string) {
  return getUrl(domain, 'api', path)
}

export function getBillingUrl(domain: string, path: string) {
  return getUrl(domain, 'billing', path)
}
