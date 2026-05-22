import * as commander from 'commander'

import { asPrimary } from 'src/utils/format'
import { profileOption } from 'src/options'
import { setProfile } from 'src/api'
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
  .addOption(profileOption)
  .hook('preAction', (thisCommand) => {
    const profile = thisCommand.opts().profile as string | undefined
    if (profile) {
      setProfile(profile)
    }
  })
  .addCommand(authCommand)
  .addCommand(templateCommand)
  .addCommand(sandboxCommand)
