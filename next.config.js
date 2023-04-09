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
