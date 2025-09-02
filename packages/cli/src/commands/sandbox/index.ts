import * as commander from 'commander'

import { connectCommand } from './connect'
import { listCommand } from './list'
import { killCommand } from './kill'
import { createCommand } from './create'
import { logsCommand } from './logs'
import { metricsCommand } from './metrics'

export const sandboxCommand = new commander.Command('sandbox')
  .description('work with sandboxes')
  .alias('sbx')
  .addCommand(connectCommand)
  .addCommand(listCommand)
  .addCommand(killCommand)
  .addCommand(createCommand('create', 'cr', false))
  .addCommand(createCommand('spawn', 'sp', true), { hidden: true })
  .addCommand(logsCommand)
  .addCommand(metricsCommand)
