import { NextRequest, NextResponse } from 'next/server'
import { landingPageHostname, landingPageFramerHostname } from '@/app/hostnames'
import { replaceUrls } from '@/utils/replaceUrls'

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

  const headers = new Headers(req.headers)

  // TODO: Not on the new landing page hosting yet
  if (url.pathname.startsWith('/ai-agents')) {
    url.hostname = landingPageFramerHostname

    const res = await fetch(url.toString(), {
      ...req,
      headers,
      redirect: 'follow',
    })

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

  return NextResponse.rewrite(url.toString(), {
    ...req,
    headers,
  })
}

// We should probably filter all /, /blog and /changelog paths here and decide what to do with them in the middleware body.
export const config = {
  matcher: [
    '/',
    '/blog/:path*',
    '/changelog/:path*',
    '/ai-agents/:path*',
    '/privacy/:path*',
    '/terms/:path*',
    '/pricing/:path*',
    '/cookbook/:path*',
  ],
}