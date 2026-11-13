import * as commander from '@commander-js/extra-typings'

import { envAccessToken, envProjectCredentialsError } from 'src/api'
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

    const envError = envProjectCredentialsError()
    if (envError) {
      console.error(asFormattedError(envError))
      process.exit(1)
    }
    if (process.env.E2B_API_KEY) {
      console.log(
        `Authenticating with E2B_API_KEY${userConfig ? '; the login below is not used' : ''}.`
      )
    } else if (envAccessToken) {
      console.log(
        `Authenticating with E2B_ACCESS_TOKEN${userConfig ? '; the login below is not used' : ''}.`
      )
    }
    if (!userConfig) {
      if (!envAccessToken && !process.env.E2B_API_KEY) {
        console.log('Not logged in')
      }
      return
    }

    console.log(asFormattedConfig(userConfig))

    process.exit(0)
  })
