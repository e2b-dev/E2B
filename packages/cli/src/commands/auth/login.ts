import * as listen from 'async-listen'
import * as commander from 'commander'
import * as fs from 'fs'
import * as http from 'http'
import * as open from 'open'
import * as path from 'path'
import * as e2b from 'e2b'

import { pkg } from 'src'
import {
  DOCS_BASE,
  getUserConfig,
  USER_CONFIG_PATH,
  UserConfig,
} from 'src/user'
import { asBold, asFormattedConfig, asFormattedError } from 'src/utils/format'
import { connectionConfig } from 'src/api'
import { handleE2BRequestError } from '../../utils/errors'

export const loginCommand = new commander.Command('login')
  .description('log in to CLI')
  .action(async () => {
    let userConfig: UserConfig | null = null

    try {
      userConfig = getUserConfig()
    } catch (err) {
      console.error(asFormattedError('Failed to read user config', err))
    }
    if (userConfig) {
      console.log(
        `\nAlready logged in. ${asFormattedConfig(
          userConfig
        )}.\n\nIf you want to log in as a different user, log out first by running 'e2b auth logout'.\nTo change the team, run 'e2b auth configure'.\n`
      )
      return
    } else if (!userConfig) {
      console.log('Attempting to log in...')
      const signInResponse = await signInWithBrowser()
      if (!signInResponse) {
        console.info('Login aborted')
        return
      }

      const accessToken =
        process.env.E2B_ACCESS_TOKEN || signInResponse.accessToken

      const signal = connectionConfig.getSignal()
      const config = new e2b.ConnectionConfig({
        accessToken,
      })
      const client = new e2b.ApiClient(config)
      const res = await client.api.GET('/teams', { signal })

      handleE2BRequestError(res, 'Error getting teams')

      const defaultTeam = res.data.find(
        (team: e2b.components['schemas']['Team']) => team.isDefault
      )
      if (!defaultTeam) {
        console.error(
          asFormattedError('No default team found, please contact support')
        )
        process.exit(1)
      }

      userConfig = {
        email: signInResponse.email,
        accessToken,
        teamName: defaultTeam.name,
        teamId: defaultTeam.teamID,
        teamApiKey: defaultTeam.apiKey,
      }

      fs.mkdirSync(path.dirname(USER_CONFIG_PATH), { recursive: true })
      fs.writeFileSync(USER_CONFIG_PATH, JSON.stringify(userConfig, null, 2))
    }

    console.log(
      `Logged in as ${asBold(userConfig.email)} with selected team ${asBold(
        userConfig.teamName
      )}`
    )
    process.exit(0)
  })

interface SignInWithBrowserResponse {
  email: string
  accessToken: string
  defaultTeamId: string
}

async function signInWithBrowser(): Promise<SignInWithBrowserResponse> {
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
      ) as unknown as SignInWithBrowserResponse & {
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

    return open.default(loginUrl.toString())
  })
}
