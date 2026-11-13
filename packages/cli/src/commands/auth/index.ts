import * as commander from '@commander-js/extra-typings'
import { loginCommand } from './login'
import { logoutCommand } from './logout'
import { infoCommand } from './info'
import { configureCommand } from './configure'

export const authCommand = new commander.Command('auth')
  .description('authentication commands')
  .addCommand(loginCommand)
  .addCommand(logoutCommand)
  .addCommand(infoCommand)
  .addCommand(configureCommand)
