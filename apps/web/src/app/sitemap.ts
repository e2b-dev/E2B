import { MetadataRoute } from 'next'
import path from 'path'
import { getPageForSitemap } from '@/utils/sitemap'

export const dynamic = 'force-static'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const docsDirectory = path.join(
    process.env.NODE_ENV === 'production'
      ? path.join('.', 'src', 'app', '(docs)', 'docs')
      : path.join(process.cwd(), 'src', 'app', '(docs)', 'docs')
  )

  const docsPages = getPageForSitemap(
    docsDirectory,
    'https://e2b.dev/docs/',
    0.8
  )

  // Deduplicate URLs, keeping the entry with highest priority
  const urlMap = new Map<string, MetadataRoute.Sitemap[0]>()
  for (const entry of docsPages) {
    const existing = urlMap.get(entry.url)
    if (!existing || (existing.priority || 0) < (entry.priority || 0)) {
      urlMap.set(entry.url, entry)
    }
  }

  return Array.from(urlMap.values()).sort((a, b) => a.url.localeCompare(b.url))
}
