import * as commander from 'commander'
import * as fs from 'fs'
import * as chalk from 'chalk'
import * as e2b from 'e2b'

import {
  USER_CONFIG_PATH,
  getConfigRefreshTimestamp,
  writeUserConfig,
} from 'src/user'
import { ensureUserConfig } from 'src/api'
import { ensureValidAccessToken } from 'src/utils/token-refresh'
import { asBold, asFormattedTeam } from '../../utils/format'
import { throwE2BRequestError } from '../../utils/errors'

type TeamsGetInit = { signal: AbortSignal | undefined }
type TeamsGetResponseData =
  e2b.paths['/teams']['get']['responses'][200]['content']['application/json']

export const configureCommand = new commander.Command('configure')
  .description('configure user')
  .action(async () => {
    const inquirer = await import('inquirer')

    console.log('Configuring user...\n')

    if (!fs.existsSync(USER_CONFIG_PATH)) {
      console.log('No user config found, run `e2b auth login` to log in first.')
      return
    }

    // ensureValidAccessToken may refresh tokens and write them to disk.
    // Re-read the config afterwards so we persist the refreshed tokens
    // instead of overwriting them with stale in-memory copies.
    const accessToken = await ensureValidAccessToken()
    const userConfig = ensureUserConfig()

    const config = new e2b.ConnectionConfig({
      apiHeaders: { Authorization: `Bearer ${accessToken}` },
    })
    const authClient = new e2b.ApiClient(config, { requireApiKey: false })

    const res = await authClient.api.GET<'/teams', TeamsGetInit>('/teams', {
      signal: config.getSignal(),
    })

    if (res.error) {
      throwE2BRequestError(res.error, 'Error getting teams')
    }
    const teams: TeamsGetResponseData = res.data

    const team = (
      await inquirer.default.prompt([
        {
          name: 'team',
          message: chalk.default.underline('Select team'),
          type: 'list',
          pageSize: 50,
          choices: teams.map((team) => ({
            name: asFormattedTeam(team, userConfig.teamId),
            value: team,
          })),
        },
      ])
    )['team']

    userConfig.teamName = team.name
    userConfig.teamId = team.teamID
    userConfig.teamApiKey = team.apiKey
    userConfig.last_refresh = getConfigRefreshTimestamp()
    writeUserConfig(USER_CONFIG_PATH, userConfig)

    console.log(`Team ${asBold(team.name)} (${team.teamID}) selected.\n`)
  })
