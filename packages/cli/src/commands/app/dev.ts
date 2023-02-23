import * as commander from 'commander'
import * as express from 'express'
import * as proxy from 'http-proxy-middleware'
import * as fsPromise from 'fs/promises'

import { getFiles, getRoot } from 'src/utils/filesystem'
import { asBold, asEnv, asFormattedError, asLocal } from 'src/utils/format'

export interface AppContentJSON {
  env?: {
    id: string
  }
  mdx: {
    name: string
    content: string
  }[]
  css?: {
    name: string
    content: string
  }[]
}

export interface AppPageContent {
  env?: {
    id: string
  }
  mdx: string
  css?: string
}

export const hiddenAppRoute = '_apps'

const defaultLocalPort = 3001
const defaultDevEndpoint = 'https://apps.usedevbook.com'

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
    logLevel: 'error',
    secure: true,
    changeOrigin: true,
    onProxyReq(proxyReq, req) {
      if (req.path === `/${hiddenAppRoute}/dev`) {
        // proxyReq.method = 'GET'
        req.body = JSON.stringify(req.body)
        proxyReq.setHeader('Content-Type', 'application/json')
        proxyReq.setHeader('content-length', Buffer.byteLength(req.body))
        proxyReq.write(req.body)
      }
    },
    pathRewrite: async path => {
      if (path === '/' || path.indexOf('.') === -1) {
        return `/${hiddenAppRoute}/dev`
      }
      return path
    },
  })

  const app = express.default()
  app.get('/', async (req, res, next) => {
    const content = await loadAppContent(rootDir)
    req.body = {
      mdx: content.mdx.find(m => m.name === 'index.mdx')?.content,
      css: content.css?.find(c => c.name === 'index.css')?.content,
    } as AppPageContent
    devEndpointProxy(req, res, next)
  })
  app.get('/*', async (req, res, next) => {
    const p = (req.params as any)['0']
    if (p.indexOf('.') === -1) {
      const content = await loadAppContent(rootDir)
      req.body = {
        mdx: content.mdx.find(m => m.name === `${p}.mdx`)?.content,
        css: content.css?.find(c => c.name === 'index.css')?.content,
      } as AppPageContent
      devEndpointProxy(req, res, next)
    } else {
      next()
    }
  })
  app.use(devEndpointProxy)
  console.log(`Devbook app from directory ${asLocal(rootDir)} available at url ${asEnv(`http://localhost:${port}`)}`)
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
  const css = await Promise.all(
    (
      await getFiles(rootDir, {
        extension: 'css',
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
    css,
    mdx,
  }
}
