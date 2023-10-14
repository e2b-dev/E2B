import * as commander from 'commander'

import { buildCommand } from './build'
import { listCommand } from './list'
import { shellCommand } from './shell'

export const envCommand = new commander.Command('env')
  .description('Manage e2b environments')
  .addCommand(buildCommand)
  .addCommand(listCommand)
  .addCommand(shellCommand)
