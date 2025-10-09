import * as commander from 'commander'

import { buildCommand } from './build'
import { listCommand } from './list'
import { initCommand } from './init'
import { deleteCommand } from './delete'
import { publishCommand, unPublishCommand } from './publish'
import { migrateCommand } from './migrate'
import { initV2Command } from './init-v2'
import { buildV2Command } from './build-v2'

export const templateCommand = new commander.Command('template')
  .description('manage sandbox templates')
  .alias('tpl')
  .addCommand(buildCommand)
  .addCommand(buildV2Command)
  .addCommand(listCommand)
  .addCommand(initCommand)
  .addCommand(initV2Command)
  .addCommand(deleteCommand)
  .addCommand(publishCommand)
  .addCommand(unPublishCommand)
  .addCommand(migrateCommand)
