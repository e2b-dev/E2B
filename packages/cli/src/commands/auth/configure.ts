import * as commander from 'commander'
import * as fs from 'fs'
import * as chalk from 'chalk'
import * as e2b from 'e2b'
import * as path from 'path'

import { USER_CONFIG_PATH } from 'src/user'
import { client, ensureAccessToken, ensureUserConfig } from 'src/api'
import { asFormattedTeam } from '../../utils/format'

const getTeams = e2b.withAccessToken(client.api.path('/teams').method('get').create())

export const configureCommand = new commander.Command('configure')
  .description('configure user')
  .action(async () => {
    const inquirer = await import('inquirer')

    console.log('Configuring user...\n')

    if (!fs.existsSync(USER_CONFIG_PATH)) {
      console.log('No user config found, run `e2b auth login` to log in first.')
      return
    }

    const userConfig = ensureUserConfig()
    const accessToken = ensureAccessToken()
    const res = await getTeams(accessToken, {})
      if (!res.ok) {
        const error: e2b.paths['/teams']['get']['responses']['500']['content']['application/json'] = res.data as any

        throw new Error(
          `Error getting user teams: ${res.statusText}, ${error.message ?? 'no message'
          }`,
        )
      }

    const team = (await inquirer.default.prompt([
      {
        name: 'team',
        message: chalk.default.underline('Select team'),
        type: 'list',
        pageSize: 50,
        choices: res.data.map(team => ({
          name: asFormattedTeam(team),
          value: team,
        })),
      },
    ]))['team']

    userConfig.teamName = team.name
    userConfig.teamId = team.teamID
    userConfig.teamApiKey = team.apiKey
    fs.mkdirSync(path.dirname(USER_CONFIG_PATH), {recursive: true})
    fs.writeFileSync(USER_CONFIG_PATH, JSON.stringify(userConfig, null, 2))

    console.log(`Team ${asFormattedTeam(team)} selected.\n`)
  })
