import * as commander from 'commander'

import { getUserConfig } from 'src/user'
import { asBold, asFormattedError } from 'src/utils/format'

export const infoCommand = new commander.Command('info')
  .description('Get information about the current user')
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

    console.log(`Logged in as ${asBold(userConfig.email)}`)
    process.exit(0)
  })
