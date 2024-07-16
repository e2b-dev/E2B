import { MetadataRoute } from 'next'
import path from 'path'
import { getPageForSitemap } from '@/utils/sitemap'

export default function sitemap(): MetadataRoute.Sitemap {
  const appDirectory = path.join(process.cwd(), 'src', 'app', '(docs)', 'docs')
  return getPageForSitemap(appDirectory, 'https://e2b.dev/docs/', 0.5).filter(
    (page) => page.url.startsWith('https://e2b.dev/docs/api/'),
  )
}
