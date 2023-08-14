/** @type {import('next').NextConfig} */
const fastDockerBuild = {
  compress: false,
  productionBrowserSourceMaps: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  optimizeFonts: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  output: 'standalone',
  experimental: {
    turbotrace: {
      memoryLimit: 1000,
    },
  },
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...process.env.BUILD === 'docker' && fastDockerBuild,
  swcMinify: true,
  experimental: {
    swcPlugins: [['next-superjson-plugin', {}]],
  },
  async rewrites() {
    return [
      {
        source: '/ingest/:path*',
        destination: 'https://app.posthog.com/:path*',
      },
    ]
  },
}

module.exports = nextConfig


// Injected content via Sentry wizard below

const { withSentryConfig } = require('@sentry/nextjs')

module.exports = process.env.BUILD === 'docker'
  ? module.exports
  : withSentryConfig(
    module.exports,
    {
      // For all available options, see:
      // https://github.com/getsentry/sentry-webpack-plugin#options

      // Suppresses source map uploading logs during build
      silent: true,

      org: 'devbook-7f',
      project: 'agent-dashboard',
    },
    {
      // For all available options, see:
      // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

      // Upload a larger set of source maps for prettier stack traces (increases build time)
      widenClientFileUpload: true,

      // Transpiles SDK to be compatible with IE11 (increases bundle size)
      transpileClientSDK: true,

      // Routes browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers (increases server load)
      tunnelRoute: '/monitoring',

      // Hides source maps from generated client bundles
      hideSourceMaps: true,

      // Automatically tree-shake Sentry logger statements to reduce bundle size
      disableLogger: true,
    }
  )
