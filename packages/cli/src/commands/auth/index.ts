import * as commander from 'commander'
import { loginCommand } from './login'
import { logoutCommand } from './logout'
import { infoCommand } from './info'


export const authCommand = new commander.Command('auth').description('authentication commands')
  .addCommand(loginCommand)
  .addCommand(logoutCommand)
  .addCommand(infoCommand)
