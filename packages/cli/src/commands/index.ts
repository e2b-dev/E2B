import * as commander from 'commander'

import { asPrimary } from 'src/utils/format'
import { templateCommand } from './template'
import { sandboxCommand } from './sandbox'
import { authCommand } from './auth'

export const program = new commander.Command()
  .description(
    `Create sandbox templates from Dockerfiles by running ${asPrimary(
      'e2b template build'
    )} then use our SDKs to create sandboxes from these templates.

Visit ${asPrimary(
      'E2B docs (https://e2b.dev/docs)'
    )} to learn how to create sandbox templates and start sandboxes.
`
  )
  .addCommand(authCommand)
  .addCommand(templateCommand)
  .addCommand(sandboxCommand)
