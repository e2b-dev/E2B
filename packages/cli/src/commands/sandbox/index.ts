import * as commander from 'commander'

import { connectCommand } from './connect'
import { listCommand } from './list'
import { killCommand } from './kill'
import { createCommand } from './create'
import { createHeadlessCommand } from './create_headless'
import { logsCommand } from './logs'
import { metricsCommand } from './metrics'
import { execCommand } from './exec'

export const sandboxCommand = new commander.Command('sandbox')
  .description('work with sandboxes')
  .alias('sbx')
  .addCommand(connectCommand)
  .addCommand(listCommand)
  .addCommand(killCommand)
  .addCommand(createCommand('create', 'cr', false))
  .addCommand(createCommand('spawn', 'sp', true), { hidden: true })
  .addCommand(createHeadlessCommand)
  .addCommand(logsCommand)
  .addCommand(metricsCommand)
  .addCommand(execCommand)
