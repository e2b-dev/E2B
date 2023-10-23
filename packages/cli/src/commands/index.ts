import * as commander from 'commander'

import { loginCommand } from './login'
import { logoutCommand } from './logout'
import { envCommand } from './env'

export const program = new commander.Command()
  .description('Tool for interacting with E2B from command line')
  .addCommand(envCommand, { isDefault: true })
  .addCommand(loginCommand)
  .addCommand(logoutCommand)
