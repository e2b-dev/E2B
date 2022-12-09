import * as commander from 'commander'

import { deleteCommand } from './delete'
import { initCommand } from './init'
import { listCommand } from './list'
import { publishCommand } from './publish'
import { pushCommand } from './push'
import { sshCommand } from './ssh'
import { useCommand } from './use'

export const envCommand = new commander.Command('env')
  .description('A command for managing Devbook environments and their configs')
  .addCommand(deleteCommand)
  .addCommand(initCommand)
  .addCommand(listCommand)
  .addCommand(publishCommand)
  .addCommand(pushCommand)
  .addCommand(useCommand)
  .addCommand(sshCommand)
