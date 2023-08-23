import nextMDX from '@next/mdx'
import path from 'path'

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
  compiler: {

  },
  experimental: {
    outputFileTracingIncludes: {
      '/': [
        path.resolve('./src/code/**/*'),
      ],
      '/docs': [
        path.resolve('./src/code/**/*'),
      ]
    },
  },
  async rewrites() {
    return [
      {
        source: '/',
        destination: '/docs',
      }
    ]
  }
}

export default withSearch(withMDX(nextConfig))
