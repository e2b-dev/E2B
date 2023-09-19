import * as commander from 'commander'

import { createCommand } from './create'
import { listCommand } from './list'
import { shellCommand } from './shell'

export const envCommand = new commander.Command('env')
  .description(`Manage e2b environments`)
  .addCommand(createCommand)
  .addCommand(listCommand)
  .addCommand(shellCommand)
  .alias('environment')
