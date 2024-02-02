import { NextRequest, NextResponse } from 'next/server'
import { replaceUrls } from '@/utils/replaceUrls'

export async function middleware(req: NextRequest): Promise<NextResponse> {
  if (req.method !== 'GET') return NextResponse.next()

  const url = new URL(req.nextUrl.toString())

  url.protocol = 'https'
  url.port = ''

  if (url.pathname === '' || url.pathname === '/') {
    url.hostname = 'e2b-landing-page.framer.website'
  }

  if (url.pathname.startsWith('/terms')) {
    url.hostname = 'e2b-landing-page.framer.website'
  }

  if (url.pathname.startsWith('/privacy')) {
    url.hostname = 'e2b-landing-page.framer.website'
  }

  if (url.pathname.startsWith('/ai-agents')) {
    url.hostname = 'e2b-landing-page.framer.website'
  }

  if (url.pathname === '/blog' || url.pathname === '/blog/') {
    url.pathname = '/'
    url.hostname = 'e2b-blog.framer.website'
  }

  if (url.pathname.startsWith('/blog')) {
    url.hostname = 'e2b-blog.framer.website'
  }

  if (url.pathname === '/changelog' || url.pathname === '/changelog/') {
    url.pathname = '/'
    url.hostname = 'e2b-changelog.framer.website'
  }
  if (url.pathname.startsWith('/changelog')) {
    url.hostname = 'e2b-changelog.framer.website'
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
  matcher: ['/', '/blog/:path*', '/changelog/:path*', '/ai-agents/:path*', '/privacy/:path*', '/terms/:path*'],
}
