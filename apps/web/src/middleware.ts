import { NextRequest, NextResponse } from 'next/server'
import { replaceUrls } from '@/utils/replaceUrls'
import {
  landingPageWebflowHostname,
  landingPageFramerHostname,
  blogFramerHostname,
  changelogFramerHostname,
} from '@/app/hostnames'

export async function middleware(req: NextRequest): Promise<NextResponse> {
  if (req.method !== 'GET') return NextResponse.next()

  const url = new URL(req.nextUrl.toString())

  url.protocol = 'https'
  url.port = ''

  if (url.pathname === '' || url.pathname === '/') {
    if (process.env.NODE_ENV === 'production') {
      url.hostname = landingPageWebflowHostname
    } else {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  if (url.pathname.startsWith('/terms')) {
    url.hostname = landingPageWebflowHostname
  }

  if (url.pathname.startsWith('/privacy')) {
    url.hostname = landingPageWebflowHostname
  }

  if (url.pathname.startsWith('/pricing')) {
    url.hostname = landingPageWebflowHostname
  }

  // TODO: Not on the new landing page hosting yet
  if (url.pathname.startsWith('/ai-agents')) {
    url.hostname = landingPageFramerHostname
  }

  if (url.pathname === '/blog' || url.pathname === '/blog/') {
    url.pathname = '/'
    url.hostname = blogFramerHostname
  }
  if (url.pathname.startsWith('/blog')) {
    url.hostname = blogFramerHostname
  }

  if (url.pathname === '/changelog' || url.pathname === '/changelog/') {
    url.pathname = '/'
    url.hostname = changelogFramerHostname
  }
  if (url.pathname.startsWith('/changelog')) {
    url.hostname = changelogFramerHostname
  }

  const res = await fetch(url.toString(), { ...req })

  const htmlBody = await res.text()

  // !!! NOTE: Replace has intentionally not completed quotes to catch the rest of the path !!!
  const modifiedHtmlBody = replaceUrls(htmlBody, url.pathname, 'href="', '">')
  // Remove the script with cdn.prod.website-files.com hostname
  const scriptRegex = /<script src="https:\/\/cdn\.prod\.website-files\.com\/[^\"]*\.js" type="text\/javascript"><\/script>/g
  const cleanedHtmlBody = modifiedHtmlBody.replace(scriptRegex, '')

  return new NextResponse(cleanedHtmlBody, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
    url: req.url,
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
    '/pricing/:path*'
  ],
}

