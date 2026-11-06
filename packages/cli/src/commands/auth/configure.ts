import * as commander from '@commander-js/extra-typings'
import * as chalk from 'chalk'
import * as e2b from 'e2b'

import {
  USER_CONFIG_PATH,
  getConfigRefreshTimestamp,
  getUserConfig,
  writeUserConfig,
} from 'src/user'
import { ensureUserConfig, Teams } from 'src/api'
import { ensureValidAccessToken } from 'src/utils/token-refresh'
import { asBold, asFormattedTeam } from '../../utils/format'
import { handleE2BRequestError } from '../../utils/errors'

export const configureCommand = new commander.Command('configure')
  .description('configure user')
  .action(async () => {
    const inquirer = await import('inquirer')

    console.log('Configuring user...\n')

    // A file that exists but fails validation counts as signed out too —
    // getUserConfig returns null for it (and prints the deprecation message).
    if (!getUserConfig()) {
      console.log('No user config found, run `e2b auth login` to log in first.')
      return
    }

    const { accessToken, config: userConfig } = await ensureValidAccessToken()

    const config = new e2b.ConnectionConfig({
      apiHeaders: { Authorization: `Bearer ${accessToken}` },
    })
    const authClient = new e2b.ApiClient(config, { requireApiKey: false })

    const res = await authClient.api.GET('/teams', {
      signal: config.getSignal(),
    })

    handleE2BRequestError(res, 'Error getting projects')
    const teams = res.data as Teams

    const team = (
      await inquirer.default.prompt([
        {
          name: 'project',
          message: chalk.default.underline('Select project'),
          type: 'list',
          pageSize: 50,
          choices: teams.map((team) => ({
            name: asFormattedTeam(team, userConfig.projectId),
            value: team,
          })),
        },
      ])
    )['project']

    // Re-read the config: another e2b process may have refreshed (and so
    // rotated) the tokens while the prompt was open, and writing back the
    // copy read before it would sign the user out on the next refresh.
    writeUserConfig(USER_CONFIG_PATH, {
      ...ensureUserConfig(),
      projectName: team.name,
      projectId: team.teamID,
      last_refresh: getConfigRefreshTimestamp(),
    })

    console.log(`Project ${asBold(team.name)} (${team.teamID}) selected.\n`)
  })
