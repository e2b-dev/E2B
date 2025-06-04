import { MetadataRoute } from 'next'
import path from 'path'
import fs from 'fs'
import { getPageForSitemap } from '@/utils/sitemap'

export const dynamic = 'force-static'

// NOTE: Sitemap should not be split into multiple files.
// This would break path validation in [app/layout.tsx]
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Try different path resolution strategies for different deployment environments
  const possiblePaths = [
    path.join('.', 'src', 'app', '(docs)', 'docs'),
    path.join(process.cwd(), 'src', 'app', '(docs)', 'docs'),
    path.join(process.cwd(), 'apps', 'web', 'src', 'app', '(docs)', 'docs'),
    path.resolve('./src/app/(docs)/docs'),
    path.resolve('./apps/web/src/app/(docs)/docs'),
  ]

  let docsDirectory: string | null = null

  for (const testPath of possiblePaths) {
    try {
      if (fs.existsSync(testPath) && fs.statSync(testPath).isDirectory()) {
        docsDirectory = testPath
        break
      }
    } catch (error) {
      continue
    }
  }

  if (!docsDirectory) {
    console.error('Could not find docs directory, returning empty sitemap')
    return []
  }

  try {
    const docsPages = getPageForSitemap(
      docsDirectory,
      'https://e2b.dev/docs/',
      0.8
    )
      // Filter out legacy docs pages
      .filter((entry) => !entry.url.includes('/docs/legacy'))

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
