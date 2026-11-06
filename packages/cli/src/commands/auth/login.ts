import * as listen from 'async-listen'
import * as commander from '@commander-js/extra-typings'
import * as http from 'http'

import * as pkg from '../../../package.json'
import {
  CLI_AUTH_URL,
  getConfigRefreshTimestamp,
  getUserConfig,
  writeUserConfig,
  USER_CONFIG_PATH,
  UserConfig,
} from 'src/user'
import { asBold, asFormattedConfig, asFormattedError } from 'src/utils/format'
import { openUrlInBrowser } from 'src/utils/openBrowser'
import {
  blockedWarning,
  bootstrapUser,
  fetchMe,
  personalProject,
  pickProject,
} from 'src/workspaces'

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
        )}.\n\nIf you want to log in as a different user, log out first by running 'e2b auth logout'.\nTo change the project, run 'e2b project use <project>' (see 'e2b project list').\n`
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

      // A user who signed up but never opened the dashboard isn't set up in
      // workspace-api yet (401); bootstrapping creates the account.
      let me = await fetchMe(accessToken)
      if (!me) {
        await bootstrapUser(accessToken)
        me = await fetchMe(accessToken)
      }
      if (!me) {
        console.error(
          asFormattedError(
            'Your account could not be set up, please contact support'
          )
        )
        process.exit(1)
      }

      let selected
      try {
        selected =
          personalProject(me) ??
          (await pickProject(me, { message: 'Select the project to use' }))
      } catch (err) {
        console.error(
          asFormattedError(err instanceof Error ? err.message : String(err))
        )
        process.exit(1)
      }
      const warning = blockedWarning(selected)
      if (warning) console.warn(warning)

      userConfig = {
        version: 2,
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
        projectName: selected.project.name,
        projectId: selected.project.id,
        projectDomain: selected.project.control_plane_domain,
      }

      writeUserConfig(USER_CONFIG_PATH, userConfig)
    }

    console.log(
      `Logged in as ${asBold(
        userConfig.identity.email
      )} with selected project ${asBold(userConfig.projectName)}`
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
  const loginUrl = new URL(CLI_AUTH_URL)
  loginUrl.searchParams.set('next', `http://localhost:${port}`)
  loginUrl.searchParams.set('cliVersion', pkg.version)

  return new Promise((resolve, reject) => {
    server.once('request', (req, res) => {
      // Close the HTTP connection to prevent `server.close()` from hanging
      res.setHeader('connection', 'close')
      const followUpUrl = new URL(CLI_AUTH_URL)
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
        !searchParamsObj.email ||
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
