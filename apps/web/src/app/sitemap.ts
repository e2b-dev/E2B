import { MetadataRoute } from 'next'
import { XMLParser } from 'fast-xml-parser'
import { replaceUrls } from '@/utils/replaceUrls'
import path from 'path'
import { getPageForSitemap } from '@/utils/sitemap'

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
    sitemapUrl: 'https://e2b-landing-page.framer.website/sitemap.xml',
    priority: 1.0,
    changeFrequency: 'daily',
  },
  {
    sitemapUrl: 'https://e2b-blog.framer.website/sitemap.xml',
    priority: 0.9,
    changeFrequency: 'daily',
  },
  {
    sitemapUrl: 'https://e2b-changelog.framer.website/sitemap.xml',
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
    return { urlset: { url: [] }}
  }

  const text = await response.text()

  return parser.parse(text) as Sitemap
}
async function getSitemap(
  site: Site,
): Promise<MetadataRoute.Sitemap> {
  const data = await getXmlData(site.sitemapUrl)

  if (!data) {
    return []
  }

  if (Array.isArray(data.urlset.url)) {
    return data.urlset.url.map((line) => {
      const url = new URL(line.loc)
      return {
        url: replaceUrls(line.loc, url.pathname),
        priority: line?.priority || site.priority,
        changeFrequency: line?.changefreq || site.changeFrequency,
      }
    })
  } else {
    const url = new URL(data.urlset.url.loc)
    return [
      {
        url: replaceUrls(data.urlset.url.loc, url.pathname),
        priority: data.urlset.url?.priority || site.priority,
        changeFrequency: data.urlset.url?.changefreq || site.changeFrequency,
      },
    ]
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let mergedSitemap: MetadataRoute.Sitemap = []


  const dashboardPath = path.join(process.cwd(), 'src', 'app', '(dashboard)', 'dashboard')
  const dashboardPages =  getPageForSitemap(dashboardPath, 'https://e2b.dev/dashboard/', 0.5)

  const docsDirectory = path.join(process.cwd(), 'src', 'app', '(docs)', 'docs')
  const docsPages = getPageForSitemap(docsDirectory, 'https://e2b.dev/docs/', 0.5).filter(
    (page) => !page.url.startsWith('https://e2b.dev/docs/api/'),
  )

  mergedSitemap = mergedSitemap.concat(dashboardPages, docsPages)

  for (const site of sites) {
    const urls = await getSitemap(site)
    mergedSitemap = mergedSitemap.concat(...urls)
  }

  return mergedSitemap.sort((a, b) => a.url.localeCompare(b.url))
}
