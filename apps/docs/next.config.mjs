import nextMDX from '@next/mdx'

import { recmaPlugins } from './src/mdx/recma.mjs'
import { rehypePlugins } from './src/mdx/rehype.mjs'
import { remarkPlugins } from './src/mdx/remark.mjs'
import withSearch from './src/mdx/search.mjs'

const withMDX = nextMDX({
  options: {
    remarkPlugins,
    rehypePlugins,
    recmaPlugins,
  },
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'mdx'],
  basePath: '/docs',
  async redirects() {
    return [
      // This is for local development and vercel previews - otherwise you would have to always add /docs to the url
      {
        source: '/',
        destination: '/docs',
        permanent: false,
        basePath: false,
      }
    ]
  }
}

export default withSearch(withMDX(nextConfig))
