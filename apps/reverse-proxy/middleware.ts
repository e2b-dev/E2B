import { NextRequest, NextResponse } from 'next/server'

export async function middleware(req: NextRequest): Promise<NextResponse> {
  if (req.method !== 'GET') return NextResponse.next()

  const url = new URL(req.nextUrl.toString())

  url.protocol = 'https'
  url.hostname = 'e2b-blog.framer.website'
  url.port = ''

  if (url.pathname === '/blog' || url.pathname === '/blog/') {
    url.pathname = '/'
  }

  const res = await fetch(url.toString(), { ...req })

  const htmlBody = await res.text()

  // Replace has intentionally not completed quotes to catch the rest of the path
  const modifiedHtmlBody = htmlBody.replaceAll(
    'href="https://e2b-blog.framer.website',
    // The default url on framer do not have /blog in the path but the custom domain does,
    // so we need to handle this explicitly.
    url.pathname === '/' ? 'href="https://e2b.dev/blog' : 'href="https://e2b.dev',
  )

  return new NextResponse(modifiedHtmlBody, {
    ...res,
    url: req.url,
  })
}

// We should probably filter all /, /blog and /changelog paths here and decide what to do with them in the middleware body.
export const config = {
  matcher: '/blog/:path*',
}
