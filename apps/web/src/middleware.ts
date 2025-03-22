import { NextRequest, NextResponse } from 'next/server'
import { replaceUrls } from '@/utils/replaceUrls'
import { landingPageHostname, landingPageFramerHostname } from '@/app/hostnames'

export async function middleware(req: NextRequest): Promise<NextResponse> {
  if (req.method !== 'GET') return NextResponse.next()

  const url = new URL(req.nextUrl.toString())

  url.protocol = 'https'
  url.port = ''

  if (url.pathname === '' || url.pathname === '/') {
    if (process.env.NODE_ENV === 'production') {
      url.hostname = landingPageHostname
    } else {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  if (url.pathname.startsWith('/terms')) {
    url.hostname = landingPageHostname
  }

  if (url.pathname.startsWith('/privacy')) {
    url.hostname = landingPageHostname
  }

  if (url.pathname.startsWith('/pricing')) {
    url.hostname = landingPageHostname
  }

  if (url.pathname.startsWith('/cookbook')) {
    url.hostname = landingPageHostname
  }

  if (url.pathname.startsWith('/changelog')) {
    url.hostname = landingPageHostname
  }

  if (url.pathname.startsWith('/blog')) {
    const segments = url.pathname.split('/')

    url.hostname = landingPageHostname

    if (segments[2] === 'category') {
      url.pathname = segments.slice(2).join('/')
    }
  }

  // TODO: Not on the new landing page hosting yet
  if (url.pathname.startsWith('/ai-agents')) {
    url.hostname = landingPageFramerHostname
  }

  const res = await fetch(url.toString(), { ...req })

  const htmlBody = await res.text()

  // !!! NOTE: Replace has intentionally not completed quotes to catch the rest of the path !!!
  const modifiedHtmlBody = replaceUrls(htmlBody, url.pathname, 'href="', '">')

  return new NextResponse(modifiedHtmlBody, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
    url: req.url,
  })
}

// We should probably filter all /, /blog and /changelog paths here and decide what to do with them in the middleware body.
export const config = {
  matcher: [
    '/ai-agents/:path*',

    // NOTE: currently disabled because we handle these rewrites for /public folder in next.config.mjs

    /*'/',
    '/blog/:path*',
    '/changelog/:path*',
    '/privacy/:path*',
    '/terms/:path*',
    '/pricing/:path*',
    '/cookbook/:path*', */
  ],
}
