import { NextRequest, NextResponse } from 'next/server'

export async function middleware(req: NextRequest): Promise<NextResponse> {
  if (req.method !== 'GET') return NextResponse.next()

  const url = new URL(req.nextUrl.toString())

  url.protocol = 'https'
  url.port = ''

  if (url.pathname === '' || url.pathname === '/') {
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

  // // !!! NOTE: Replace has intentionally not completed quotes to catch the rest of the path !!!
  // const modifiedHtmlBody = htmlBody
  //   .replaceAll('href="https://e2b-landing-page.framer.website', 'href="https://e2b.dev')
  //   .replaceAll(
  //     'href="https://e2b-blog.framer.website',
  //     // The default url on framer does not have /blog in the path but the custom domain does,
  //     // so we need to handle this explicitly.
  //     url.pathname === '/' ? 'href="https://e2b.dev/blog' : 'href="https://e2b.dev',
  //   )
  //   .replaceAll(
  //     'href="https://e2b-changelog.framer.website',
  //     // The default url on framer does not have /changelog in the path but the custom domain does,
  //     // so we need to handle this explicitly.
  //     url.pathname === '/' ? 'href="https://e2b.dev/changelog' : 'href="https://e2b.dev',
  //   )

    const modifiedHtmlBody = htmlBody
    .replaceAll('href="https://e2b-landing-page.framer.website', 'href="https://e2b.dev')
    .replaceAll(
    'href="https://e2b-blog.framer.website',
    url.pathname === '/' ? 'href="https://e2b.dev/blog' : 'href="https://e2b.dev',
    )
    .replaceAll(
    'href="https://e2b-changelog.framer.website',
    url.pathname === '/' ? 'href="https://e2b.dev/changelog' : 'href="https://e2b.dev',
    )
    .replaceAll(
    'href="https://e2b-blog.framer.website',
    'href="https://e2b.dev/blog',
    )
    .replaceAll(
      'href="https://e2b-changelog.framer.website',
      'href="https://e2b.dev/changelog',
      )

    console.log(modifiedHtmlBody)



  return new NextResponse(modifiedHtmlBody, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
    url: req.url,
  })
}

// We should probably filter all /, /blog and /changelog paths here and decide what to do with them in the middleware body.
export const config = {
  matcher: ['/', '/blog/:path*', '/changelog/:path*'],
}




// const htmlBody = '<link rel="canonical" href="https://e2b.dev/blog/">'

// // !!! NOTE: Replace has intentionally not completed quotes to catch the rest of the path !!!
//   const modifiedHtmlBody = htmlBody
//     .replaceAll('href="https://e2b-landing-page.framer.website', 'href="https://e2b.dev')
//     // add one more condition that replaces this version "https://e2b-blog.framer.website/ with "https://e2b.dev/blog too
//     .replaceAll('href="https://e2b-blog.framer.website/', 'href="https://e2b.dev/blog')
//     .replaceAll(
//       'href="https://e2b-blog.framer.website',
//       // The default url on framer does not have /blog in the path but the custom domain does,
//       // so we need to handle this explicitly.
//       '/' === '/' ? 'href="https://e2b.dev/blog' : 'href="https://e2b.dev',
//     )
//     .replaceAll(
//       'href="https://e2b-changelog.framer.website',
//       // The default url on framer does not have /changelog in the path but the custom domain does,
//       // so we need to handle this explicitly.
//       '/' === '/' ? 'href="https://e2b.dev/changelog' : 'href="https://e2b.dev',
//     )

// console.log(modifiedHtmlBody)