import * as commander from 'commander'

import { getUserConfig, deleteUserProfile } from 'src/user'
import { currentProfileName } from 'src/api'

export const logoutCommand = new commander.Command('logout')
  .description('log out of CLI')
  .action(() => {
    if (getUserConfig(currentProfileName)) {
      deleteUserProfile(currentProfileName)
      console.log(
        currentProfileName === 'default'
          ? 'Logged out.'
          : `Profile '${currentProfileName}' removed.`
      )
    } else {
      console.log(
        currentProfileName === 'default'
          ? 'Not logged in, nothing to do'
          : `Profile '${currentProfileName}' not found, nothing to do`
      )
    }
  })
