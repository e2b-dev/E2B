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
}

module.exports = nextConfig
