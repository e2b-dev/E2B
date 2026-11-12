import * as commander from '@commander-js/extra-typings'

import { envAccessToken } from 'src/api'
import { getUserConfig } from 'src/user'
import { asFormattedConfig, asFormattedError } from 'src/utils/format'

export const infoCommand = new commander.Command('info')
  .description('get information about the current user')
  .action(async () => {
    let userConfig
    try {
      userConfig = getUserConfig()
    } catch (err) {
      console.error(asFormattedError('Failed to read user config', err))
    }

    if (envAccessToken) {
      console.log(
        `Authenticating with E2B_ACCESS_TOKEN${userConfig ? '; the login below is not used' : ''}.`
      )
    }
    if (!userConfig) {
      if (!envAccessToken) console.log('Not logged in')
      return
    }

    console.log(asFormattedConfig(userConfig))

    process.exit(0)
  })
