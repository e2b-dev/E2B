import * as commander from 'commander'

import { devCommand } from './dev'

export const appCommand = new commander.Command('app')
  .description('Develop and manage Devbook applications')
  .addCommand(devCommand)
  .alias('application')
