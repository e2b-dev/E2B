import * as commander from 'commander'

import { connectCommand } from './connect'
import { listCommand } from './list'

export const templateCommand = new commander.Command('sandbox')
  .alias('sbx')
  .addCommand(connectCommand)
  .addCommand(listCommand)
