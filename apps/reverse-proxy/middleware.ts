import { NextRequest, NextResponse } from 'next/server'

export async function middleware(req: NextRequest): Promise<NextResponse> {
  if (req.method !== 'GET') return NextResponse.next()

  const url = new URL(req.nextUrl.toString())

  url.protocol = 'https'
  url.hostname = 'e2b-blog.framer.website'
  url.port = ''

  if (url.pathname === '/blog') {
    url.pathname = '/'
  }

  console.log(url.toString())

  const res = await fetch(url.toString(), { ...req })

  const htmlBody = await res.text()

  // Replace has intentionally not compelted quotes to catch the rest of the path
  const modifiedHtmlBody = htmlBody.replaceAll(
    'href="https://e2b-blog.framer.website',
    'href="https://e2b.dev/blog',
  )

  return new NextResponse(modifiedHtmlBody, res)
}

export const config = {
  matcher: '/blog/:path*',
}
