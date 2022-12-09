import * as commander from 'commander'

import { envCommand } from './env'

export const program = new commander.Command()
  .description('Tool for interacting with Devbook from command line')
  .addCommand(envCommand)
