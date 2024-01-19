import { MetadataRoute } from 'next'
import { XMLParser } from 'fast-xml-parser'

type ChangeFrequency =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never'

type FramerWebsite = {
  sitemapUrl: string
  lastModified?: string | Date
  changeFrequency?: ChangeFrequency
  priority?: number
}

const framerWebsites: FramerWebsite[] = [
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

const otherApps = ['https://e2b.dev/docs/sitemap.xml']

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

  const response = await fetch(url)

  if (!response.ok) {
    return { urlset: { url: [] }}
  }

  const text = await response.text()

  return parser.parse(text) as Sitemap
}
async function getSitemap(
  url: string,
  priority?: number,
  changeFrequency?: ChangeFrequency
): Promise<MetadataRoute.Sitemap> {
  const data = await getXmlData(url)

  if (!data) {
    return []
  }

  if (Array.isArray(data.urlset.url)) {
    return data.urlset.url.map((line) => {
      return {
        url: line.loc,
        priority: line?.priority || priority,
        changeFrequency: line?.changefreq || changeFrequency,
      }
    })
  } else {
    return [
      {
        url: data.urlset.url.loc,
        priority: data.urlset.url?.priority || priority,
        changeFrequency: data.urlset.url?.changefreq || changeFrequency,
      },
    ]
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let mergedSitemap: MetadataRoute.Sitemap = []

  for (const nativeUrl of otherApps) {
    const urls = await getSitemap(nativeUrl)
    mergedSitemap = mergedSitemap.concat(...urls)
  }

  for (const framerWebsite of framerWebsites) {
    const urls = await getSitemap(
      framerWebsite.sitemapUrl,
      framerWebsite.priority,
      framerWebsite.changeFrequency
    )
    mergedSitemap = mergedSitemap.concat(...urls)
  }

  return mergedSitemap
}
