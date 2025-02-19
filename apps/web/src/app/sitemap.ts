import { MetadataRoute } from 'next'
import { XMLParser } from 'fast-xml-parser'
import path from 'path'
import { replaceUrls } from '@/utils/replaceUrls'
import { getPageForSitemap } from '@/utils/sitemap'
import {
  landingPageHostname,
  landingPageFramerHostname,
  blogFramerHostname,
  changelogFramerHostname,
} from '@/app/hostnames'

type ChangeFrequency =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never'

type Site = {
  sitemapUrl: string
  lastModified?: string | Date
  changeFrequency?: ChangeFrequency
  priority?: number
}

const sites: Site[] = [
  {
    sitemapUrl: `https://${landingPageHostname}/sitemap.xml`,
    priority: 1.0,
    changeFrequency: 'daily',
  },
  {
    sitemapUrl: `https://${blogFramerHostname}/sitemap.xml`,
    priority: 0.9,
    changeFrequency: 'daily',
  },
  {
    sitemapUrl: `https://${changelogFramerHostname}/sitemap.xml`,
    priority: 0.2,
    changeFrequency: 'weekly',
  },
]

type SitemapData = {
  loc: string
  lastmod?: string | Date
  changefreq?: ChangeFrequency
  priority?: number
}

type Sitemap = {
  urlset: {
    url: SitemapData | SitemapData[]
  }
}

async function getXmlData(url: string): Promise<Sitemap> {
  const parser = new XMLParser()

  const response = await fetch(url, { cache: 'no-cache' })

  if (!response.ok) {
    return { urlset: { url: [] } }
  }

  const text = await response.text()

  return parser.parse(text) as Sitemap
}
async function getSitemap(site: Site): Promise<MetadataRoute.Sitemap> {
  const data = await getXmlData(site.sitemapUrl)

  if (!data) {
    return []
  }

  const normalizeUrl = (inputUrl: string, pathname: string) => {
    // First normalize the URL format
    let normalizedUrl = inputUrl
      .replace(/^www\./, '') // Remove www. prefix
      .replace(/https:\/\/https:\/\//, 'https://') // Fix double https://
      .replace(/^https:\/\/www\./, 'https://') // Remove www. after https://

    // Parse the URL to work with its components
    const urlObj = new URL(normalizedUrl)

    // Normalize category URLs to include /blog prefix
    if (pathname.startsWith('/category/')) {
      urlObj.pathname = `/blog${pathname}`
    }

    // Convert back to string for further processing
    normalizedUrl = urlObj.toString()

    // Apply replaceUrls after initial normalization
    normalizedUrl = replaceUrls(normalizedUrl, urlObj.pathname)

    // Ensure all URLs use e2b.dev domain
    // Handle both www. and non-www variants
    const hostnames = [
      landingPageFramerHostname,
      landingPageHostname,
      changelogFramerHostname,
      blogFramerHostname,
    ]

    for (const hostname of hostnames) {
      normalizedUrl = normalizedUrl
        .replace(`www.${hostname}`, 'e2b.dev')
        .replace(hostname, 'e2b.dev')
    }

    // Final cleanup for any remaining double https:// or www.
    return normalizedUrl
      .replace(/https:\/\/https:\/\//, 'https://')
      .replace(/^https:\/\/www\./, 'https://')
  }

  if (Array.isArray(data.urlset.url)) {
    return data.urlset.url.map((line) => {
      const url = new URL(line.loc)
      const pathname = url.pathname

      return {
        url: normalizeUrl(line.loc, pathname),
        priority: line?.priority || site.priority,
        changeFrequency: line?.changefreq || site.changeFrequency,
      }
    })
  } else {
    const url = new URL(data.urlset.url.loc)
    const pathname = url.pathname

    return [
      {
        url: normalizeUrl(data.urlset.url.loc, pathname),
        priority: data.urlset.url?.priority || site.priority,
        changeFrequency: data.urlset.url?.changefreq || site.changeFrequency,
      },
    ]
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let mergedSitemap: MetadataRoute.Sitemap = []

  const dashboardPath = path.join(
    process.cwd(),
    'src',
    'app',
    '(dashboard)',
    'dashboard'
  )
  const dashboardPages = getPageForSitemap(
    dashboardPath,
    'https://e2b.dev/dashboard/',
    0.5
  )

  const docsDirectory = path.join(process.cwd(), 'src', 'app', '(docs)', 'docs')
  const docsPages = getPageForSitemap(
    docsDirectory,
    'https://e2b.dev/docs/',
    0.5
  ).filter((page) => !page.url.startsWith('https://e2b.dev/docs/api/'))

  mergedSitemap = mergedSitemap.concat(dashboardPages, docsPages)

  for (const site of sites) {
    const urls = await getSitemap(site)
    mergedSitemap = mergedSitemap.concat(...urls)
  }

  // Deduplicate URLs, keeping the entry with highest priority
  const urlMap = new Map<string, MetadataRoute.Sitemap[0]>()
  for (const entry of mergedSitemap) {
    const existing = urlMap.get(entry.url)
    if (!existing || (existing.priority || 0) < (entry.priority || 0)) {
      urlMap.set(entry.url, entry)
    }
  }

  return Array.from(urlMap.values()).sort((a, b) => a.url.localeCompare(b.url))
}
