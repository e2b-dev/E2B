import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  console.log('MIDDLEWARE HEADERS', Array.from(request.headers.entries()))

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-middleware-pathname', path)

  // Ensure the header is forwarded
  if (request.headers.get('x-e2b-should-index') === '1') {
    requestHeaders.set('x-e2b-should-index', 'true')
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })
}

export const config = {
  matcher: '/docs/:path*',
}
