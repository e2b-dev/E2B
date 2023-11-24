import * as listen from 'async-listen'
import * as commander from 'commander'
import * as fs from 'fs'
import * as http from 'http'
import * as open from 'open'
import * as path from 'path'

import { pkg } from 'src'
import { DOCS_BASE, getUserConfig, USER_CONFIG_PATH, UserConfig } from 'src/user'
import { asBold, asFormattedError } from 'src/utils/format'

export const loginCommand = new commander.Command('login')
  .description('Log in to CLI')
  .action(async () => {
    let userConfig
    try {
      userConfig = getUserConfig()
    } catch (err) {
      console.error(asFormattedError('Failed to read user config', err))
    }
    if (userConfig) {
      console.log(
        `Already logged in as ${asBold(
          userConfig.email,
        )}, if you want to login as a different user, logout first by running 'e2b logout'.`,
      )
      return
    } else if (!userConfig) {
      console.log('Attempting to login...')
      userConfig = await signInWithBrowser()
      if (!userConfig) {
        console.info('Login aborted')
        return
      }
      fs.mkdirSync(path.dirname(USER_CONFIG_PATH), { recursive: true })
      fs.writeFileSync(USER_CONFIG_PATH, JSON.stringify(userConfig, null, 2))
    }
    console.log(`Logged in as ${asBold(userConfig.email)}`)
    process.exit(0)
  })

async function signInWithBrowser(): Promise<UserConfig> {
  const server = http.createServer()
  const { port } = await listen.default(server, 0, '127.0.0.1')
  const loginUrl = new URL(`${DOCS_BASE}/api/cli`)
  loginUrl.searchParams.set('next', `http://localhost:${port}`)
  loginUrl.searchParams.set('cliVersion', pkg.version)

  return new Promise((resolve, reject) => {
    server.once('request', (req, res) => {
      // Close the HTTP connection to prevent `server.close()` from hanging
      res.setHeader('connection', 'close')
      const followUpUrl = new URL(`${DOCS_BASE}/api/cli`)
      const searchParams = new URL(req.url || '/', 'http://localhost')
        .searchParams
      const searchParamsObj = Object.fromEntries(
        searchParams.entries()
      ) as unknown as UserConfig & {
        error?: string;
      }
      const { error } = searchParamsObj
      if (error) {
        reject(new Error(error))
        followUpUrl.searchParams.set('state', 'error')
        followUpUrl.searchParams.set('error', error)
      } else {
        resolve(searchParamsObj)
        followUpUrl.searchParams.set('state', 'success')
        followUpUrl.searchParams.set('email', searchParamsObj.email!)
      }

      res.statusCode = 302
      res.setHeader('location', followUpUrl.href)
      res.end()
    })

    return open.default(loginUrl.toString())
  })
}
