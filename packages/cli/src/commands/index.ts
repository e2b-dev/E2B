import * as commander from 'commander'

import { loginCommand } from './login'
import { logoutCommand } from './logout'
import { buildCommand } from './build'
import { listCommand } from './list'
import { shellCommand } from './shell'
import { initCommand } from './init'
import { asPrimary } from 'src/utils/format'



export const program = new commander.Command()
  .description(`Create sandbox templates from Dockerfiles by running ${asPrimary('e2b build')} then use our SDKs to create sandboxes from these templates.

Visit ${asPrimary('E2B docs (https://e2b.dev/docs)')} to learn how to create sandbox templates and start sandboxes.
`)
  .addCommand(loginCommand)
  .addCommand(logoutCommand)
  .addCommand(buildCommand)
  .addCommand(listCommand)
  .addCommand(shellCommand)
  .addCommand(initCommand)
