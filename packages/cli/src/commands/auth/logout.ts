import * as commander from 'commander'
import * as fs from 'fs'

import { USER_CONFIG_PATH } from 'src/user'

export const logoutCommand = new commander.Command('logout')
  .description('log out of CLI')
  .action(() => {
    if (fs.existsSync(USER_CONFIG_PATH)) {
      fs.unlinkSync(USER_CONFIG_PATH) // Delete user config
      console.log('Logged out.')
    } else {
      console.log('Not logged in, nothing to do')
    }
  })
