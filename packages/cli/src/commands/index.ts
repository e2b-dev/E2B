import * as commander from 'commander'

// import { envCommand } from './env'
// import { runCommand } from './run'
import { loginCommand, logoutCommand } from './auth'

export const program = new commander.Command()
  .description('Tool for interacting with e2b from command line')
  // .addCommand(envCommand, { isDefault: true }) // Re-enable later
  // .addCommand(runCommand, { hidden: true }) // Re-enable later
  .addCommand(loginCommand)
  .addCommand(logoutCommand)
