/** @type {import('next').NextConfig} */
const nextConfig = {
  swcMinify: true,
  experimental: {
    // swcPlugins: [['next-superjson-plugin', {}]],
  },
  async rewrites() {
    return [
      {
        source: '/generate',
        destination: 'http://localhost:49155/generate',
      },
      {
        source: '/db',
        destination: 'http://localhost:3000/db',
      },
    ]
  },
}

module.exports = nextConfig
