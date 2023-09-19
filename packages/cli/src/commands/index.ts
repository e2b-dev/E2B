import * as commander from 'commander'

import { loginCommand, logoutCommand } from './auth'
import { envCommand } from './env'

export const program = new commander.Command()
  .description('Tool for interacting with e2b from command line')
  .addCommand(envCommand)
  .addCommand(loginCommand)
  .addCommand(logoutCommand)
