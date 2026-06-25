import * as listen from 'async-listen'
import * as commander from 'commander'
import * as http from 'http'
import * as e2b from 'e2b'

import { pkg } from 'src'
import {
  DOCS_BASE,
  getConfigRefreshTimestamp,
  getUserConfig,
  writeUserConfig,
  USER_CONFIG_PATH,
  UserConfig,
} from 'src/user'
import { asBold, asFormattedConfig, asFormattedError } from 'src/utils/format'
import { openUrlInBrowser } from 'src/utils/openBrowser'
import { connectionConfig, Teams } from 'src/api'
import { throwE2BRequestError } from '../../utils/errors'

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

      const accessToken = signInResponse.accessToken

      const signal = connectionConfig.getSignal()
      const config = new e2b.ConnectionConfig({
        apiHeaders: { Authorization: `Bearer ${accessToken}` },
      })
      const client = new e2b.ApiClient(config, { requireApiKey: false })
      const res = await client.api.GET('/teams', {
        signal,
      })

      if (res.error) {
        throwE2BRequestError(res.error, 'Error getting teams')
      }
      const teams = res.data as Teams

      const defaultTeam = teams.find((team) => team.isDefault)
      if (!defaultTeam) {
        console.error(
          asFormattedError('No default team found, please contact support')
        )
        process.exit(1)
      }

      userConfig = {
        version: 1,
        identity: {
          email: signInResponse.email,
        },
        oauth: {
          token_endpoint: signInResponse.tokenEndpoint,
          revoke_endpoint: signInResponse.revokeEndpoint,
          client_id: signInResponse.clientId,
        },
        tokens: {
          access_token: accessToken,
          refresh_token: signInResponse.refreshToken,
        },
        last_refresh: getConfigRefreshTimestamp(),
        teamName: defaultTeam.name,
        teamId: defaultTeam.teamID,
        teamApiKey: defaultTeam.apiKey,
      }

      writeUserConfig(USER_CONFIG_PATH, userConfig)
    }

    console.log(
      `Logged in as ${asBold(
        userConfig.identity.email
      )} with selected team ${asBold(userConfig.teamName)}`
    )
    process.exit(0)
  })

interface SignInWithBrowserResponse {
  email: string
  accessToken: string
  refreshToken: string
  tokenEndpoint: string
  revokeEndpoint: string
  clientId: string
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
      } else if (
        !searchParamsObj.accessToken ||
        !searchParamsObj.refreshToken ||
        !searchParamsObj.tokenEndpoint ||
        !searchParamsObj.revokeEndpoint ||
        !searchParamsObj.clientId
      ) {
        reject(new Error('Incomplete login response from server'))
        followUpUrl.searchParams.set('state', 'error')
        followUpUrl.searchParams.set(
          'error',
          'Incomplete login response from server'
        )
      } else {
        resolve(searchParamsObj)
        followUpUrl.searchParams.set('state', 'success')
        followUpUrl.searchParams.set('email', searchParamsObj.email!)
      }

      res.statusCode = 302
      res.setHeader('location', followUpUrl.href)
      res.end()
    })

    let manualUrlPrinted = false
    const printManualUrl = () => {
      if (manualUrlPrinted) return
      manualUrlPrinted = true
      console.log(
        `\nCould not open a browser automatically. Please open the following URL manually to continue:\n\n${loginUrl.toString()}\n\nIf interactive login is unavailable, you can also authenticate by setting the ${asBold(
          'E2B_API_KEY'
        )} environment variable instead.\n`
      )
    }

    openUrlInBrowser(loginUrl.toString(), printManualUrl)
  })
}
