import { MetadataRoute } from 'next'

// Export a default function named 'robots'. This function returns a 'Robots' object.
export default function robots(): MetadataRoute.Robots {
 return {
   rules: {
     // 'userAgent': '*' means that these rules apply to all web crawlers.
     userAgent: '*',
     
     // 'allow': '/' means that all pages of the site are accessible to the web crawler.
     allow: '/',
     disallow: '/private/',
     // disallow: ['/private/', '/docs/getting-started/api-key/', '/docs/sandbox/api/filesystem/'], - Example of how to add disallowed urls
   },

   // Web crawlers use the sitemap to find all the pages on the site.
   sitemap: 'https://e2b.dev/sitemap.xml',
 }
}