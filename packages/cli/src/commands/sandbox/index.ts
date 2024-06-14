import * as commander from 'commander'

import { connectCommand } from './connect'
import { listCommand } from './list'
import { killCommand } from './kill'
import { createCommand } from './create'
import { logsCommand } from './logs'

export const sandboxCommand = new commander.Command('sandbox').description('work with sandboxes')
  .alias('sbx')
  .addCommand(connectCommand)
  .addCommand(listCommand)
  .addCommand(killCommand)
  .addCommand(createCommand)
  .addCommand(logsCommand)
