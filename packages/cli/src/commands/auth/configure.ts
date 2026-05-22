import * as commander from 'commander'
import * as chalk from 'chalk'
import * as e2b from 'e2b'

import { getUserConfig, saveUserConfig } from 'src/user'
import {
  client,
  connectionConfig,
  currentProfileName,
  ensureAccessToken,
} from 'src/api'
import { asBold, asFormattedTeam } from '../../utils/format'
import { handleE2BRequestError } from '../../utils/errors'

export const configureCommand = new commander.Command('configure')
  .description('configure user')
  .action(async () => {
    const inquirer = await import('inquirer')

    console.log('Configuring user...\n')

    const userConfig = getUserConfig(currentProfileName)
    if (!userConfig) {
      console.log(
        `No config found for profile '${currentProfileName}', run 'e2b auth login' to log in first.`
      )
      return
    }

    ensureAccessToken()
    const signal = connectionConfig.getSignal()

    const res = await client.api.GET('/teams', { signal })

    handleE2BRequestError(res, 'Error getting teams')

    const team = (
      await inquirer.default.prompt([
        {
          name: 'team',
          message: chalk.default.underline('Select team'),
          type: 'list',
          pageSize: 50,
          choices: res.data.map((team: e2b.components['schemas']['Team']) => ({
            name: asFormattedTeam(team, userConfig.teamId ?? ''),
            value: team,
          })),
        },
      ])
    )['team']

    userConfig.teamName = team.name
    userConfig.teamId = team.teamID
    userConfig.teamApiKey = team.apiKey
    saveUserConfig(userConfig, currentProfileName)

    console.log(`Team ${asBold(team.name)} (${team.teamID}) selected.\n`)
  })
