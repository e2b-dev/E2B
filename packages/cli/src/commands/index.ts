import * as commander from 'commander'

import { loginCommand } from './login'
import { logoutCommand } from './logout'
import { templateCommand } from './template'

export const program = new commander.Command()
  .description('Tool for interacting with E2B from command line')
  .addCommand(templateCommand, { isDefault: true })
  .addCommand(loginCommand)
  .addCommand(logoutCommand)
