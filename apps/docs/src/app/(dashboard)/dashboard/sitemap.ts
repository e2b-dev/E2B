import { MetadataRoute } from 'next'
import path from 'path'
import { getPageForSitemap } from '@/utils/sitemap'

export default function sitemap(): MetadataRoute.Sitemap {
  const appDirectory = path.join(
    process.cwd(),
    'src',
    'app',
    '(dashboard)',
    'dashboard',
  )
  return getPageForSitemap(appDirectory, 'https://e2b.dev/dashboard/', 0.5)
}
