import * as commander from 'commander'

import { connectCommand } from './connect'
import { listCommand } from './list'
import { killCommand } from './kill'
import { spawnCommand } from './spawn'

export const sandboxCommand = new commander.Command('sandbox').description('Work with sandboxes')
  .alias('sbx')
  .addCommand(connectCommand)
  .addCommand(listCommand)
  .addCommand(killCommand)
  .addCommand(spawnCommand)
