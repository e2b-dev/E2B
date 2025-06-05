import { MetadataRoute } from 'next'
import fs from 'fs'
import fg from 'fast-glob'

export const dynamic = 'force-static'

// NOTE: Sitemap should not be split into multiple files.
// This would break path validation in [app/layout.tsx]
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    console.log(process.cwd())

    const isDev = process.env.NODE_ENV === 'development'

    // Use different patterns for dev vs production
    // Dev: source .mdx files, Production: compiled .js files in .next/server
    const patterns = isDev
      ? [
          // Development patterns - look for source .mdx files
          'src/app/\\(docs\\)/docs/**/page.mdx', // When CWD is apps/web
          'apps/web/src/app/\\(docs\\)/docs/**/page.mdx', // When CWD is repo root
        ]
      : [
          // Production patterns - look for compiled .js files
          '.next/server/app/\\(docs\\)/docs/**/page.js', // When CWD is apps/web
          'apps/web/.next/server/app/\\(docs\\)/docs/**/page.js', // When CWD is repo root
        ]

    let mdxFiles: string[] = []

    for (const pattern of patterns) {
      const files = await fg(pattern, {
        cwd: process.cwd(),
        absolute: true,
      })

      console.log(`Pattern: ${pattern}, Found: ${files.length} files`)

      if (files.length > 0) {
        mdxFiles = files
        break
      }
    }

    console.log('Found files:', mdxFiles.slice(0, 5), '...') // Show first 5 files

    if (mdxFiles.length === 0) {
      console.error('Could not find any page files, returning empty sitemap')
      return []
    }

    // Convert file paths to sitemap entries with proper normalization
    const docsPages: MetadataRoute.Sitemap = mdxFiles
      .map((filePath) => {
        try {
          // Find the /docs/ segment and extract everything after it
          // Handle both source (.mdx) and compiled (.js) paths
          const docsMatch = isDev
            ? filePath.match(/\/app\/\(docs\)\/docs\/(.*)\/page\.mdx$/)
            : filePath.match(/\/app\/\(docs\)\/docs\/(.*)\/page\.js$/)

          if (!docsMatch) {
            console.warn(`Unexpected file path format: ${filePath}`)
            return null
          }

          const pathname = docsMatch[1] || ''

          // Normalize pathname to always start with /docs
          const normalizedPath = `/docs${pathname ? `/${pathname}` : ''}`

          const url = `https://e2b.dev${normalizedPath}`
          const lastModified = fs.statSync(filePath).mtime

          return {
            url,
            lastModified,
            priority: 0.8,
          }
        } catch (error) {
          console.error(`Error processing file ${filePath}:`, error)
          return null
        }
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      // Filter out legacy docs pages
      .filter((entry) => !entry.url.includes('/docs/legacy'))

    console.log(
      `Generated ${docsPages.length} sitemap entries (${
        isDev ? 'dev' : 'prod'
      } mode)`
    )

    // Deduplicate URLs, keeping the entry with highest priority
    const urlMap = new Map<string, MetadataRoute.Sitemap[0]>()
    for (const entry of docsPages) {
      const existing = urlMap.get(entry.url)
      if (!existing || (existing.priority || 0) < (entry.priority || 0)) {
        urlMap.set(entry.url, entry)
      }
    }

    return Array.from(urlMap.values()).sort((a, b) =>
      a.url.localeCompare(b.url)
    )
  } catch (error) {
    console.error(
      'Error generating sitemap:',
      error instanceof Error ? error.message : error
    )
    return []
  }
}
