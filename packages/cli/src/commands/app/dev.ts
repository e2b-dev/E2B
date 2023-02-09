import * as commander from 'commander'
import * as express from 'express'
import * as proxy from 'http-proxy-middleware'
import * as fsPromise from 'fs/promises'

import { getFiles, getRoot } from 'src/utils/filesystem'
import { asBold, asFormattedError } from 'src/utils/format'

export interface AppContentJSON {
  env?: {
    id: string
  }
  mdx: {
    name: string
    content: string
  }[]
}

export const hiddenAppRoute = '_apps'

const defaultLocalPort = 3001
const defaultDevEndpoint = 'https://app.usedevbook.com'

export const devCommand = new commander.Command('develop')
  .description('Start development server for Devbook application')
  .option(
    '-p, --port <port>',
    `Use ${asBold('<port>')} for local development server`,
    defaultLocalPort.toString(),
  )
  .option(
    '-e, --endpoint <endpoint>',
    `Use remote ${asBold('<endpoint>')} for rendering apps`,
    defaultDevEndpoint,
  )
  .alias('dev')
  .action(async opts => {
    try {
      process.stdout.write('\n')
      const rootDir = getRoot()

      startDevelopmentServer({
        port: parseInt(opts.port),
        endpoint: opts.endpoint as string,
        rootDir,
      })
    } catch (err: any) {
      console.error(asFormattedError(err.message))
      process.exit(1)
    }
  })

function startDevelopmentServer({
  port,
  endpoint,
  rootDir,
}: {
  port: number
  endpoint: string
  rootDir: string
}) {
  const devEndpointProxy = proxy.createProxyMiddleware({
    target: endpoint,
    logLevel: 'debug',
    secure: true,
    changeOrigin: true,
    onProxyReq(proxyReq, req) {
      if (req.path === `/${hiddenAppRoute}/dev`) {
        // proxyReq.method = 'GET'
        console.log(req.body)
        req.body = JSON.stringify(req.body)
        proxyReq.setHeader('Content-Type', 'application/json')
        proxyReq.setHeader('content-length', Buffer.byteLength(req.body))
        proxyReq.write(req.body)
      }
    },
    pathRewrite: async path => {
      if (path === '/') {
        return `/${hiddenAppRoute}/dev`
      }
      return path
    },
  })

  const app = express.default()
  app.get('/', async (req, res, next) => {
    const body = await loadAppContent(rootDir)
    req.body = body
    devEndpointProxy(req, res, next)
  })
  app.use(devEndpointProxy)
  app.listen(port)
}

async function loadAppContent(rootDir: string): Promise<AppContentJSON> {
  // const envFiles = await getFiles(rootDir, {
  //   name: configName,
  // })

  // if (envFiles.length !== 1)
  //   throw new Error(
  //     `Cannot find ${asLocal(configName)} in the ${asLocal(rootDir)} directory.`,
  // )

  // const env = await loadConfig(envFiles[0].rootPath)
  const mdx = await Promise.all(
    (
      await getFiles(rootDir, {
        extension: 'mdx',
      })
    ).map(async f => {
      const content = await fsPromise.readFile(f.path, 'utf-8')
      return {
        name: f.name,
        content,
      }
    }),
  )

  return {
    // env,
    mdx,
  }
}
