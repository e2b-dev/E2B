import * as commander from 'commander'

import { buildCommand } from './build'
import { listCommand } from './list'
import { spawnCommand } from './spawn'
import { initCommand } from './init'
import { deleteCommand } from './delete'

export const templateCommand = new commander.Command('template').description('Manage sandbox templates')
  .alias('tpl')
  .addCommand(buildCommand)
  .addCommand(listCommand)
  .addCommand(spawnCommand)
  .addCommand(initCommand)
  .addCommand(deleteCommand)
