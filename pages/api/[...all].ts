// import httpProxy from 'http-proxy'
// import { NextApiRequest, NextApiResponse } from 'next'

// export const config = {
//   api: {
//     // Enable `externalResolver` option in Next.js
//     externalResolver: true,
//     bodyParser: false,
//   },
// }

// async function handler(req: NextApiRequest, res: NextApiResponse) {
//   const url = new URL(req.url!, `http://${req.headers.host}`)

//   return new Promise((resolve, reject) => {
//     const proxy: httpProxy = httpProxy.createProxy()
//     proxy.once('proxyRes', resolve).once('error', reject).web(req, res, {
//       changeOrigin: true,
//       target: url.pathname === '/api/generate' ? process.env.API_URL : process.env.SUPABASE_URL,
//     })
//   })
// }

// export default handler
