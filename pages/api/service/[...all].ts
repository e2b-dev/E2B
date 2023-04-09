import { createProxyMiddleware } from 'http-proxy-middleware'

export const config = {
  api: {
    // Proxy middleware will handle requests itself, so Next.js should 
    // ignore that our handler doesn't directly return a response
    externalResolver: true,
    // Pass request bodies through unmodified so that the origin API server
    // receives them in the intended format
    bodyParser: false,
  },
}

const pathPrefix = '/api/service'

const target = process.env.API_URL!
const isSecure = target.startsWith('https://')

export default createProxyMiddleware(`${pathPrefix}/**`, {
  target,
  // ws: true,
  secure: !isSecure,
  changeOrigin: true,
  pathRewrite: { [`^${pathPrefix}`]: '' }, // remove prefix
})
