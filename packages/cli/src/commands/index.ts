import * as commander from 'commander'

import { loginCommand } from './login'
import { logoutCommand } from './logout'
import { envCommand } from './env'

export const program = new commander.Command()
  .description('Tool for interacting with e2b from command line')
  .addCommand(envCommand)
  .addCommand(loginCommand)
  .addCommand(logoutCommand)
