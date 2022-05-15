import express from 'express'

const port = process.env.PORT || 3001

const app = express()

async function main() {
  app
    .use(
      express.json({
        limit: '10mb',
      }),
    )
    .all('*', (req, res) => {
      res.send({
        headers: req.headers,
        query: req.query,
        originalURL: req.originalUrl,
        url: req.url,
        route: req.route,
      })
    })
    .listen({ port }, () => {
      // eslint-disable-next-line no-console
      console.log(`Server is ready on port "${port}".`)
    })
    .setTimeout(30_000) // 30 000ms
}

if (require.main === module) main()