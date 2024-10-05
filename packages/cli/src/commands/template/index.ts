import * as commander from 'commander'

import { buildCommand } from './build'
import { listCommand } from './list'
import { initCommand } from './init'
import { deleteCommand } from './delete'

export const templateCommand = new commander.Command('template')
  .description('manage sandbox templates')
  .alias('tpl')
  .addCommand(buildCommand)
  .addCommand(listCommand)
  .addCommand(initCommand)
  .addCommand(deleteCommand)
