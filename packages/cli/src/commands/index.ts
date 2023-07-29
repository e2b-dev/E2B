import * as commander from 'commander'

import { runCommand } from './run'
import { envCommand } from './env'

export const program = new commander.Command()
  .description('Tool for interacting with Devbook from command line')
  .addCommand(runCommand, { isDefault: true })
  .addCommand(envCommand)
