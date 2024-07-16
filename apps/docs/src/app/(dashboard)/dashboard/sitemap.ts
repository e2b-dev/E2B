import { MetadataRoute } from 'next'
import fs from 'fs'
import path from 'path'
import { getAllPageFilePaths } from '@/utils/sitemap'

function nonNull<T>(value: T | null): value is T {
  return value !== null
}

export default function sitemap(): MetadataRoute.Sitemap {
  const appDirectory = path.join(process.cwd(), 'src', 'app', '(dashboard)', 'dashboard')
  const mdxFilePaths = getAllPageFilePaths(appDirectory)
  const priority = 0.5

  return mdxFilePaths
    .map((filePath) => {
      const pathname = path
        .relative(appDirectory, filePath)
        .replace(/\/page\.mdx$/, '')
      const url = `https://e2b.dev/dashboard/${pathname}`
      const lastModified = fs.statSync(filePath).mtime
      return {
        url,
        lastModified,
        priority,
      }
    })
    .filter(nonNull)
}
