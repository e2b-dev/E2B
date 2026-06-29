import * as e2b from 'e2b'
import * as commander from 'commander'

import { spawnConnectedTerminal, TerminalOpts } from 'src/terminal'
import { asBold, asPrimary } from 'src/utils/format'
import { ensureAPIKey } from '../../api'
import { parseEnv } from 'src/utils/env'
import { printDashboardSandboxInspectUrl } from 'src/utils/urls'

export const connectCommand = new commander.Command('connect')
  .description('connect terminal to already running sandbox')
  .argument('<sandboxID>', `connect to sandbox with ${asBold('<sandboxID>')}`)
  .option('-u, --user <user>', 'user to start the terminal session as')
  .option('-c, --cwd <dir>', 'working directory for the terminal session')
  .option(
    '-e, --env <KEY=VALUE>',
    'set environment variable for the terminal session (repeatable)',
    parseEnv,
    {} as Record<string, string>
  )
  .alias('cn')
  .action(
    async (
      sandboxID: string,
      opts: { user?: string; cwd?: string; env?: Record<string, string> }
    ) => {
      try {
        const apiKey = ensureAPIKey()

        if (!sandboxID) {
          console.error('You need to specify sandbox ID')
          process.exit(1)
        }

        await connectToSandbox({
          apiKey,
          sandboxID,
          terminal: {
            user: opts.user,
            cwd: opts.cwd,
            envs:
              opts.env && Object.keys(opts.env).length > 0
                ? opts.env
                : undefined,
          },
        })
        // We explicitly call exit because the sandbox is keeping the program alive.
        // We also don't want to call sandbox.close because that would disconnect other users from the edit session.
        process.exit(0)
      } catch (err: any) {
        console.error(err)
        process.exit(1)
      }
    }
  )

async function connectToSandbox({
  apiKey,
  sandboxID,
  terminal,
}: {
  apiKey: string
  sandboxID: string
  terminal?: TerminalOpts
}) {
  const sandbox = await e2b.Sandbox.connect(sandboxID, { apiKey })

  printDashboardSandboxInspectUrl(sandbox.sandboxId)

  console.log(
    `Terminal connecting to sandbox ${asPrimary(`${sandbox.sandboxId}`)}`
  )
  await spawnConnectedTerminal(sandbox, terminal)
  console.log(
    `Closing terminal connection to sandbox ${asPrimary(sandbox.sandboxId)}`
  )
}
