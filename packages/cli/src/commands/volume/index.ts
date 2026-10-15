import * as commander from 'commander'

import {
  createCommand,
  deleteCommand,
  infoCommand,
  listCommand,
} from './commands'

export const volumeCommand = new commander.Command('volume')
  .description(
    'manage volumes — persistent storage that can be mounted into sandboxes'
  )
  .addCommand(createCommand)
  .addCommand(listCommand)
  .addCommand(infoCommand)
  .addCommand(deleteCommand)
