import * as commander from 'commander'

import {
  createCommand,
  deleteCommand,
  infoCommand,
  listCommand,
  updateCommand,
} from './commands'

export const secretCommand = new commander.Command('secret')
  .description(
    'manage secrets — values stored server-side and injected into sandboxes'
  )
  .addCommand(createCommand)
  .addCommand(listCommand)
  .addCommand(infoCommand)
  .addCommand(updateCommand)
  .addCommand(deleteCommand)
