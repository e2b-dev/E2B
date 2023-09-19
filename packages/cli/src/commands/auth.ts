import * as commander from 'commander'
import open from 'open'
import {listen} from 'async-listen'
import {asBold, asFormattedError} from 'src/utils/format'
import path from 'path'
import * as os from 'os'
import fs from 'fs'
import http from 'http'
import pkg from '../../package.json'

type UserConfig = {
  email: string
  accessToken: string
  defaultTeamApiKey: string
  defaultTeamId: string
}

const USER_CONFIG_PATH = path.join(os.homedir(), '.e2b', 'config.json') // TODO: Keep in Keychain
const DOCS_BASE = process.env.E2B_DOCS_BASE || `https://e2b.dev/docs`

export const loginCommand = new commander.Command('login')
  .description('Login to e2b')
  .action(async () => {
    let userConfig
    try {
      userConfig = getUserConfig()
    } catch (err) {
      console.error(asFormattedError(`Failed to read user config`, err))
    }
    if (userConfig) {
      console.log(
        `Already logged in as ${asBold(
          userConfig.email,
        )}, if you want to login as a different user, logout first.`,
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

export const logoutCommand = new commander.Command('logout')
  .description('Logout of e2b')
  .action(() => {
    if (fs.existsSync(USER_CONFIG_PATH)) {
      fs.unlinkSync(USER_CONFIG_PATH) // Delete user config
      console.log(`Logged out.`)
    } else {
      console.log(`Not logged in, nothing to do`)
    }
  })

export function getUserConfig(): UserConfig | null {
  if (!fs.existsSync(USER_CONFIG_PATH)) return null
  return JSON.parse(fs.readFileSync(USER_CONFIG_PATH, 'utf8'))
}

async function signInWithBrowser(): Promise<UserConfig> {
  const server = http.createServer()
  const { port } = await listen(server, 0, '127.0.0.1')
  const loginUrl = new URL(`${DOCS_BASE}/api/cli`)
  loginUrl.searchParams.set('next', `http://localhost:${port}`)
  loginUrl.searchParams.set('cliVersion', pkg.version)

  return new Promise((resolve, reject) => {
    server.once('request', (req, res) => {
      // Close the HTTP connection to prevent `server.close()` from hanging
      res.setHeader('connection', 'close')
      const followUpUrl = new URL(`${DOCS_BASE}/api/cli`)
      const searchParams = new URL(req.url || '/', 'http://localhost').searchParams
      const searchParamsObj = Object.fromEntries(searchParams.entries()) as UserConfig & {
        error?: string
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

    return open(loginUrl.toString())
  })
}
