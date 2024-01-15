// Generate a Robots file
// Add a robots.js or robots.ts file that returns a Robots object.

import { MetadataRoute } from 'next'
 
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/private/',
    },
    sitemap: 'https://e2b.dev/sitemap.xml',
  }
}


// Guide to creating robots.txt file: https://nextjs.org/docs/app/api-reference/file-conventions/metadata/robots