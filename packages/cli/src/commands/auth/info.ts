import * as commander from 'commander'

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

    if (!userConfig) {
      console.log('Not logged in')
      return
    }

    console.log(asFormattedConfig(userConfig))
    process.exit(0)
  })
