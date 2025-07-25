import * as commander from 'commander'

import { connectCommand } from './connect'
import { listCommand } from './list'
import { killCommand } from './kill'
import { spawnCommand } from './spawn'
import { logsCommand } from './logs'
import { metricsCommand } from './metrics'

export const sandboxCommand = new commander.Command('sandbox')
  .description('work with sandboxes')
  .alias('sbx')
  .addCommand(connectCommand)
  .addCommand(listCommand)
  .addCommand(killCommand)
  .addCommand(spawnCommand)
  .addCommand(logsCommand)
  .addCommand(metricsCommand)
