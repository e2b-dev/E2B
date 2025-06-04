import { MetadataRoute } from 'next'
import path from 'path'
import fs from 'fs'
import { getPageForSitemap } from '@/utils/sitemap'

export const dynamic = 'force-static'

// NOTE: Sitemap should not be split into multiple files.
// This would break path validation in [app/layout.tsx]
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Debug logging for path resolution
  console.log('=== SITEMAP DEBUG INFO ===')
  console.log('process.cwd():', process.cwd())
  console.log('VERCEL_ENV:', process.env.VERCEL_ENV)
  console.log('NODE_ENV:', process.env.NODE_ENV)
  console.log(
    '__dirname available:',
    typeof __dirname !== 'undefined' ? __dirname : 'undefined'
  )

  // Try different path resolution strategies
  const possiblePaths = [
    // Original production path
    path.join('.', 'src', 'app', '(docs)', 'docs'),
    // Alternative production paths
    path.join(process.cwd(), 'src', 'app', '(docs)', 'docs'),
    path.join(process.cwd(), 'apps', 'web', 'src', 'app', '(docs)', 'docs'),
    // Try from current working directory
    path.resolve('./src/app/(docs)/docs'),
    path.resolve('./apps/web/src/app/(docs)/docs'),
  ]

  let docsDirectory: string | null = null

  console.log('Checking possible paths:')
  for (const testPath of possiblePaths) {
    console.log(`- Testing path: ${testPath}`)
    try {
      if (fs.existsSync(testPath)) {
        const stat = fs.statSync(testPath)
        if (stat.isDirectory()) {
          console.log(`  ✅ Found valid directory: ${testPath}`)
          docsDirectory = testPath
          break
        } else {
          console.log(`  ❌ Path exists but is not a directory: ${testPath}`)
        }
      } else {
        console.log(`  ❌ Path does not exist: ${testPath}`)
      }
    } catch (error) {
      console.log(
        `  ❌ Error checking path ${testPath}:`,
        error instanceof Error ? error.message : error
      )
    }
  }

  if (!docsDirectory) {
    console.log('❌ No valid docs directory found!')
    console.log('Available files in current directory:')
    try {
      const cwdContents = fs.readdirSync(process.cwd())
      console.log('cwd contents:', cwdContents)

      // Try to find src directory
      if (cwdContents.includes('src')) {
        const srcContents = fs.readdirSync(path.join(process.cwd(), 'src'))
        console.log('src contents:', srcContents)
      }
    } catch (error) {
      console.log(
        'Error reading current directory:',
        error instanceof Error ? error.message : error
      )
    }

    // Return empty sitemap to prevent build failure
    return []
  }

  console.log(`Using docs directory: ${docsDirectory}`)

  try {
    const docsPages = getPageForSitemap(
      docsDirectory,
      'https://e2b.dev/docs/',
      0.8
    )
      // Filter out legacy docs pages
      .filter((entry) => !entry.url.includes('/docs/legacy'))

    console.log(`Found ${docsPages.length} docs pages`)

    // Deduplicate URLs, keeping the entry with highest priority
    const urlMap = new Map<string, MetadataRoute.Sitemap[0]>()
    for (const entry of docsPages) {
      const existing = urlMap.get(entry.url)
      if (!existing || (existing.priority || 0) < (entry.priority || 0)) {
        urlMap.set(entry.url, entry)
      }
    }

    const result = Array.from(urlMap.values()).sort((a, b) =>
      a.url.localeCompare(b.url)
    )
    console.log(`Final sitemap has ${result.length} entries`)
    console.log('=== END SITEMAP DEBUG INFO ===')

    return result
  } catch (error) {
    console.error(
      'Error generating sitemap:',
      error instanceof Error ? error.message : error
    )
    console.log('=== END SITEMAP DEBUG INFO ===')
    return []
  }
}
