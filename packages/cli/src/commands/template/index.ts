import * as commander from 'commander'

import { createCommand } from './create'
import { buildCommand } from './build'
import { deleteCommand } from './delete'
import { initCommand } from './init'
import { listCommand } from './list'
import { migrateCommand } from './migrate'
import { publishCommand, unPublishCommand } from './publish'

export const templateCommand = new commander.Command('template')
  .description('manage sandbox templates')
  .alias('tpl')
  .addCommand(createCommand)
  .addCommand(buildCommand, { hidden: true })
  .addCommand(listCommand)
  .addCommand(initCommand)
  .addCommand(deleteCommand)
  .addCommand(publishCommand)
  .addCommand(unPublishCommand)
  .addCommand(migrateCommand)
