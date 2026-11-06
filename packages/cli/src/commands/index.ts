import * as commander from '@commander-js/extra-typings'

import { setProjectOverride } from 'src/api'
import { projectIdFromOptions, projectOption } from 'src/options'
import { asPrimary } from 'src/utils/format'
import { templateCommand } from './template'
import { initCommand } from './template/init'
import { migrateCommand } from './template/migrate'
import { sandboxCommand } from './sandbox'
import { authCommand } from './auth'
import { workspaceCommand } from './workspace'
import { projectCommand } from './project'

// Commands that only touch local files, so a project doesn't apply.
const localCommands: commander.CommandUnknownOpts[] = [
  initCommand,
  migrateCommand,
]

/** Give every API command under `group` a `--project` option. */
function addProjectOption(group: commander.CommandUnknownOpts) {
  for (const command of group.commands) {
    if (command.commands.length) {
      addProjectOption(command)
    } else if (
      !localCommands.includes(command) &&
      !command.options.some((option) => option.long === '--project')
    ) {
      command.addOption(projectOption)
    }
  }
}
addProjectOption(sandboxCommand)
addProjectOption(templateCommand)

export const program = new commander.Command()
  // Fixed so help reads `e2b` however the entrypoint is invoked (npm bin
  // symlink, `node dist/index.js`, or a distro wrapper script).
  .name('e2b')
  .enablePositionalOptions()
  .description(
    `Create sandbox templates from Dockerfiles by running ${asPrimary(
      'e2b template create'
    )} then use our SDKs to create sandboxes from these templates.

Visit ${asPrimary(
      'E2B docs (https://e2b.dev/docs)'
    )} to learn how to create sandbox templates and start sandboxes.`
  )
  // `--project` is read here rather than in each action, so every helper that
  // calls ensureAuth() picks it up without threading it through.
  .hook('preAction', (_program, actionCommand) => {
    setProjectOverride(
      projectIdFromOptions(
        actionCommand.opts() as { project?: string; team?: string }
      )
    )
  })
  .addCommand(authCommand)
  .addCommand(workspaceCommand)
  .addCommand(projectCommand)
  .addCommand(templateCommand)
  .addCommand(sandboxCommand)
