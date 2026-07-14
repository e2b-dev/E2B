import * as commander from 'commander'

import { setCommandAttribution } from 'src/api'
import { asPrimary } from 'src/utils/format'
import { templateCommand } from './template'
import { sandboxCommand } from './sandbox'
import { authCommand } from './auth'

// Canonical dot-joined path of the invoked command (aliases resolved),
// without the program name, e.g. `sandbox.list`.
function commandPath(command: commander.Command): string {
  const names: string[] = []
  for (
    let cmd: commander.Command | null = command;
    cmd?.parent;
    cmd = cmd.parent
  ) {
    names.unshift(cmd.name())
  }
  return names.join('.')
}

export const program = new commander.Command()
  .hook('preAction', (_, actionCommand) => {
    setCommandAttribution(commandPath(actionCommand))
  })
  .description(
    `Create sandbox templates from Dockerfiles by running ${asPrimary(
      'e2b template create'
    )} then use our SDKs to create sandboxes from these templates.

Visit ${asPrimary(
      'E2B docs (https://e2b.dev/docs)'
    )} to learn how to create sandbox templates and start sandboxes.
`
  )
  .addCommand(authCommand)
  .addCommand(templateCommand)
  .addCommand(sandboxCommand)
