import { NextRequest, NextResponse } from 'next/server'
import { landingPageFramerHostname } from '@/app/hostnames'
import { replaceUrls } from '@/utils/replaceUrls'

export async function middleware(req: NextRequest): Promise<NextResponse> {
  if (req.method !== 'GET') return NextResponse.next()

  const url = new URL(req.nextUrl.toString())

  url.protocol = 'https'
  url.port = ''

  const headers = new Headers(req.headers)

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

export const config = {
  matcher: ['/ai-agents/:path*'],
}
