import * as commander from 'commander'
import { appCommand } from './app'

import { envCommand } from './env'

export const program = new commander.Command()
  .description('Tool for interacting with Devbook from command line')
  .addCommand(envCommand, { isDefault: true })
  .addCommand(appCommand)
