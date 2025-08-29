import fs from 'fs'
import path from 'path'
import { MetadataRoute } from 'next'

function nonNull<T>(value: T | null): value is T {
  return value !== null
}

export function getPageForSitemap(
  directory: string,
  urlPrefix: string,
  priority: number
): MetadataRoute.Sitemap {
  const files = getFiles(directory)

  return files
    .map((filePath) => {
      let pathname = path
        .relative(directory, filePath)
        .replace(/\/page\.mdx$/, '')
        .replace(/\/page\.tsx$/, '')

      if (pathname == 'page.tsx' || pathname == 'page.mdx') {
        pathname = ''
      }

      const url = new URL(pathname, urlPrefix).href.replace(/\/$/, '')
      const lastModified = fs.statSync(filePath).mtime
      return {
        url,
        lastModified,
        priority,
      }
    })
    .filter(nonNull)
}
function getFiles(directory: string): string[] {
  const fileNames = fs.readdirSync(directory)
  const filePaths = fileNames
    .map((fileName) => {
      const filePath = path.join(directory, fileName)
      const stat = fs.statSync(filePath)
      if (stat.isDirectory()) {
        return getFiles(filePath)
      } else if (
        path.basename(filePath) === 'page.mdx' ||
        path.basename(filePath) === 'page.tsx'
      ) {
        return filePath
      }
    })
    .filter(Boolean)

  return Array.prototype.concat(...filePaths)
}
