import * as commander from 'commander'
import * as express from 'express'
import * as proxy from 'http-proxy-middleware'

import { getGuideData } from 'src/app'
import { pathOption } from 'src/options'
import { getRoot } from 'src/utils/filesystem'
import { asFormattedError } from 'src/utils/format'

import test from './test.json'

const defaultLocalPort = 3001
const defaultDevEndpoint = 'https://3000-devbookhq-ui-bdurd1rl9pv.ws-eu84.gitpod.io'

export const devCommand = new commander.Command('dev')
  .description('Start development server for Devbook application')
  .option(
    '-p, --port <port>',
    'Use specified local port for the development server',
    defaultLocalPort.toString(),
  )
  .addOption(pathOption)
  .alias('dv')
  .action(async opts => {
    try {
      process.stdout.write('\n')
      const watcherDir = getRoot(opts.path)

      startDevelopmentServer({
        port: parseInt(opts.port),
        endpoint: defaultDevEndpoint,
        dir: watcherDir,
      })
    } catch (err: any) {
      console.error(asFormattedError(err.message))
      process.exit(1)
    }
  })

function startDevelopmentServer({
  port,
  endpoint,
  dir,
}: {
  port: number
  endpoint: string
  dir: string
}) {
  const devEndpointProxy = proxy.createProxyMiddleware({
    target: endpoint,
    logLevel: 'debug',
    secure: true,
    changeOrigin: true,
    onProxyReq(proxyReq, req, res) {
      if (req.path === '/_sites/dev') {
        // Add req.body logic here if needed....

        proxyReq.method = 'POST'
        // ....

        // Remove body-parser body object from the request

        // Make any needed POST parameter changes
        // let body: any = new Object()

        // body.filename = 'reports/statistics/summary_2016.pdf'
        // body.routeId = 's003b012d002'
        // body.authId = 'bac02c1d-258a-4177-9da6-862580154960'

        // URI encode JSON object
        req.body = JSON.stringify(req.body)
        // Update header
        proxyReq.setHeader('content-type', 'application/x-www-form-urlencoded')
        proxyReq.setHeader('content-length', req.body.length)

        // Write out body changes to the proxyReq stream
        proxyReq.write(req.body)
        proxyReq.end()
      }
    },
    pathRewrite: async (path, req) => {
      if (path === '/') {
        return '/_sites/dev'
      }
      return path
    },
  })

  const app = express.default()
  app.get('/', async (req, res, next) => {
    const body = await loadAppProps()

    req.body = body
    devEndpointProxy(req, res, next)
  })
  app.use(devEndpointProxy)
  app.listen(port)
}

async function loadAppProps() {
  return getGuideData({
    branch: 'dev',
    project_id: 'test',
    repository_fullname: 'test',
    slug: '',
    content: test,
  })
}
