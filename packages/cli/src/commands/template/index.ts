import * as commander from 'commander'

import { buildCommand } from './build'
import { listCommand } from './list'
import { initCommand } from './init'
import { deleteCommand } from './delete'
import { publishCommand, unPublishCommand } from './publish'

export const templateCommand = new commander.Command('template')
  .description('manage sandbox templates')
  .alias('tpl')
  .addCommand(buildCommand)
  .addCommand(listCommand)
  .addCommand(initCommand)
  .addCommand(deleteCommand)
  .addCommand(publishCommand)
  .addCommand(unPublishCommand)
