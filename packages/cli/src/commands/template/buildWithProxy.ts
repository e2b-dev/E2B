import child_process from 'child_process'
import * as e2b from 'e2b'
import * as http from 'http'
import * as url from 'url'
import * as https from 'node:https'
import { confirm } from '../../utils/confirm'
import { USER_CONFIG_PATH, UserConfig } from 'src/user'
import * as fs from 'fs'

const PORT = 49984

export async function buildWithProxy(
  userConfig: UserConfig | null,
  connectionConfig: e2b.ConnectionConfig,
  accessToken: string,
  template: { templateID: string; buildID: string },
  root: string
) {
  if (!userConfig?.dockerProxySet) {
    console.log(
      'There was an issue during Docker authentication. Please follow the workaround steps from https://e2b.dev/docs/troubleshooting/templates/build-authentication-error and then continue.'
    )
    const yes = await confirm(
      'Have you completed the steps from the https://e2b.dev/docs/troubleshooting/templates/build-authentication-error workaround guide?'
    )

    if (!yes) {
      console.log(
        'Please follow the workaround steps from https://e2b.dev/docs/troubleshooting/templates/build-authentication-error and then try again.'
      )
      process.exit(1)
    }
  }

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
  const success = await docker(connectionConfig, template, root)

  if (!success) {
    console.error('Docker push failed')
    process.exit(1)
  }

  if (userConfig && !userConfig.dockerProxySet) {
    userConfig.dockerProxySet = true
    fs.writeFileSync(USER_CONFIG_PATH, JSON.stringify(userConfig, null, 2))
  }

  proxyServer.close()
}

async function docker(
  connectionConfig: e2b.ConnectionConfig,
  template: { templateID: string; buildID: string },
  root: string
) {
  const localDomain =
    process.platform === 'linux' ? 'localhost' : 'host.docker.internal'
  let success = false

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
    success = true
    onExit!(code)
  })

  child.on('error', (err) => {
    console.error('Error', err)
    process.exit(1)
  })

  await dockerBuilt
  return success
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
    (clientReq: http.IncomingMessage, clientRes: http.ServerResponse) => {
      // Parse the target URL
      const targetUrl = new url.URL(
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

      // Type-safe header manipulation
      const headers = options.headers as http.OutgoingHttpHeaders

      if (!headers.Authorization) {
        if (targetUrl.pathname.startsWith('/v2/token')) {
          headers.Authorization = `Basic ${credsBase64}`
        } else if (
          targetUrl.pathname == '/v2/' ||
          targetUrl.pathname == '/v2'
        ) {
          headers.Authorization = `Bearer ${credsBase64}`
        } else if (
          // Exclude the artifacts-uploads namespace
          !targetUrl.pathname.startsWith('/artifacts-uploads/namespaces')
        ) {
          headers.Authorization = `Bearer ${token}`
        }
      }

      // Create the proxy getHeaders
      const proxyReq: http.ClientRequest = https.request(
        options,
        (proxyRes: http.IncomingMessage) => {
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
