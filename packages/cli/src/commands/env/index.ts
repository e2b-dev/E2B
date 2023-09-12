import * as commander from 'commander'

import { deleteCommand } from './delete'
import { createCommand } from './create'
import { listCommand } from './list'
import { publishCommand } from './publish'
import { pushCommand } from './push'
import { connectCommand } from './connect'
import { useCommand } from './use'
import { asLocal } from 'src/utils/format'
import { configName } from 'src/config'
import { setCommand } from './set'

export const envCommand = new commander.Command('env')
  .description(`Manage e2b environments and their ${asLocal(configName)} configs`)
  .addCommand(createCommand)
  .addCommand(pushCommand)
  .addCommand(publishCommand)
  .addCommand(deleteCommand)
  .addCommand(useCommand)
  .addCommand(connectCommand)
  .addCommand(listCommand)
  .addCommand(setCommand)
  .alias('environment')
