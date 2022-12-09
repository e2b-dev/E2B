import * as commander from 'commander'

import { envCommand } from './env'

export const program = new commander.Command()
  .description('A tool for interacting with Devbook from command line or CI/CD')
  .addCommand(envCommand)
