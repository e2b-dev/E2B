import nextMDX from '@next/mdx'
import * as crypto from 'crypto'
import * as fsWalk from '@nodelib/fs.walk'
import fs from 'fs'
import path from 'path'

import { recmaPlugins } from './src/mdx/recma.mjs'
import { rehypePlugins } from './src/mdx/rehype.mjs'
import { remarkPlugins } from './src/mdx/remark.mjs'
import withSearch from './src/mdx/search.mjs'
import { withSentryConfig } from '@sentry/nextjs'

const withMDX = nextMDX({
  options: {
    remarkPlugins,
    rehypePlugins,
    recmaPlugins,
  },
})

const delimiter = '\0'

function getFilesHash(rootPath) {
  const shasum = crypto.createHash('sha1')

  function processFile(name, content) {
    shasum.update(name)
    // Add delimiter to hash to prevent collisions between files where the join of the name and content is the same
    shasum.update(delimiter)
    shasum.update(content)
    shasum.update(delimiter)
  }

  fsWalk.walkSync(rootPath, { stats: true }).forEach(e => {
    if (!e.stats.isDirectory()) {
      if (e.path.includes('/node_modules/')) return // ignore node_modules which may contain symlinks
      const content = fs.readFileSync(e.path, 'utf8')
      processFile(e.path, content)
    }
  })

  return shasum.digest('base64')
}

const codeSnippetsDir = path.resolve('./src/code')

const isProd = process.env.NODE_ENV === 'production'

/** @type {import('next').NextConfig} */
const nextConfig = {
  assetPrefix: isProd ? '/assets' : '',
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'mdx'],
  basePath: '',
  webpack: config => {
    const codeFilesHash = getFilesHash(codeSnippetsDir)
    config.cache.version = config.cache.version + delimiter + codeFilesHash
    return config
  },
  async rewrites() {
    return {
      afterFiles: [
        {
          source: '/ingest/:path*',
          destination: 'https://app.posthog.com/:path*',
          // BEWARE: setting basePath will break the analytics proxy
        },
        { source: '/:path*', destination: '/_404/:path*' },
      ]
    }
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboard',
        permanent: false,
        basePath: false,
      },
    ]
  },
}

export default withSearch(
  withMDX(
    withSentryConfig(
      nextConfig,
      {
        silent: true,
        org: 'e2b',
        project: 'docs',
      },
      {
        widenClientFileUpload: true,
        transpileClientSDK: true,
        tunnelRoute: '/monitoring',
        hideSourceMaps: true,
        disableLogger: true,
      },
    ),
  ),
)
