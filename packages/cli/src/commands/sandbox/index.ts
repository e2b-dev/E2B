import * as commander from 'commander'

import { connectCommand } from './connect'
import { killCommand } from './kill'
import { listCommand } from './list'
import { logsCommand } from './logs'
import { metricsCommand } from './metrics'
import { spawnCommand } from './spawn'

export const sandboxCommand = new commander.Command('sandbox')
  .description('work with sandboxes')
  .alias('sbx')
  .addCommand(connectCommand)
  .addCommand(listCommand)
  .addCommand(killCommand)
  .addCommand(spawnCommand)
  .addCommand(logsCommand)
  .addCommand(metricsCommand)
