import child_process from 'child_process'
import * as e2b from 'e2b'
import * as http from 'http'
import { URL } from 'url'
import { IncomingMessage, ServerResponse, ClientRequest } from 'http'
import * as https from 'node:https'

const PORT = 49984
export async function buildWithProxy(
  connectionConfig: e2b.ConnectionConfig,
  accessToken: string,
  template: { templateID: string; buildID: string },
  root: string
) {
  // TODO:
  console.log(
    'Here should be some instructions what to do, probably link to docs. Also check if already configured, if yes skip this step.'
  )
  let proxyStarted: ((value: unknown) => void) | undefined = undefined

  const proxyReady = new Promise((resolve) => {
    proxyStarted = resolve
  })

  const accessTokenBase64Encoded = Buffer.from(
    `_e2b_access_token:${accessToken}`
  ).toString('base64')

  const proxyServer = await proxy(
    connectionConfig,
    template,
    accessTokenBase64Encoded,
    proxyStarted!
  )

  await proxyReady
  await docker(connectionConfig, template, root)

  proxyServer.close()
}

async function docker(
  connectionConfig: e2b.ConnectionConfig,
  template: { templateID: string; buildID: string },
  root: string
) {
  const localDomain =
    process.platform === 'linux' ? 'localhost' : 'host.docker.internal'

  child_process.execSync(
    `docker tag docker.${connectionConfig.domain}/e2b/custom-envs/${template.templateID}:${template.buildID} ${localDomain}:${PORT}/e2b/custom-envs/${template.templateID}:${template.buildID}`,
    {
      stdio: 'inherit',
      cwd: root,
    }
  )

  let onExit: ((code: number | null) => void) | undefined = undefined
  const dockerBuilt = new Promise((resolve) => {
    onExit = resolve
  })

  const child = child_process.spawn(
    'docker',
    [
      'push',
      `${localDomain}:${PORT}/e2b/custom-envs/${template.templateID}:${template.buildID}`,
    ],
    {
      detached: true,
      stdio: 'inherit',
      cwd: root,
    }
  )
  child.on('exit', (code) => {
    if (code !== 0) {
      console.error('Docker push failed')
      process.exit(1)
    }
    onExit!(code)
  })

  child.on('error', (err) => {
    console.error('Error', err)
    process.exit(1)
  })

  await dockerBuilt
}

async function proxy(
  connectionConfig: e2b.ConnectionConfig,
  template: { templateID: string; buildID: string },
  credsBase64: string,
  proxyStarted: (value: unknown) => void
) {
  const res = await fetch(
    `https://docker.${connectionConfig.domain}/v2/token?account=_e2b_access_token&scope=repository%3Ae2b%2Fcustom-envs%2F${template.templateID}%3Apush%2Cpull`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credsBase64}`,
      },
    }
  )

  const { token } = await res.json()

  const proxyServer = http.createServer(
    (clientReq: IncomingMessage, clientRes: ServerResponse) => {
      // Parse the target URL
      const targetUrl = new URL(
        clientReq.url || '/',
        `https://docker.${connectionConfig.domain}`
      )

      // Construct options for the proxy request
      const options = {
        protocol: 'https:',
        hostname: targetUrl.hostname,
        method: clientReq.method,
        path: targetUrl.pathname + targetUrl.search,
        headers: {
          ...clientReq.headers,
          host: targetUrl.hostname,
        },
      } as http.RequestOptions

      if (!options.headers!.Authorization) {
        if (targetUrl.pathname.startsWith('/v2/token')) {
          options.headers!.Authorization = `Basic ${credsBase64}`
        } else if (
          targetUrl.pathname == '/v2/' ||
          targetUrl.pathname == '/v2'
        ) {
          options.headers!.Authorization = `Bearer ${credsBase64}`
        } else {
          options.headers!.Authorization = `Bearer ${token}`
        }
      }

      // Create the proxy getHeaders
      const proxyReq: ClientRequest = https.request(
        options,
        (proxyRes: IncomingMessage) => {
          // Copy status code and headers
          clientRes.writeHead(proxyRes.statusCode || 500, proxyRes.headers)
          // Pipe the response data
          proxyRes.pipe(clientRes, {
            end: true,
          })
        }
      )

      // Handle proxy request errors
      proxyReq.on('error', (err: Error) => {
        console.error('Proxy Request Error:', err)
        clientRes.statusCode = 500
        clientRes.end(`Proxy Error: ${err.message}`)
      })

      // Pipe the client request data to proxy request
      clientReq.pipe(proxyReq, {
        end: true,
      })
    }
  )

  // Handle server errors
  proxyServer.on('error', (err: Error) => {
    console.error('Server Error:', err)
  })

  // Start the server
  proxyServer.listen(PORT, () => {
    proxyStarted(null)
    console.log(`Proxy server running on port ${PORT}`)
  })

  return proxyServer
}
