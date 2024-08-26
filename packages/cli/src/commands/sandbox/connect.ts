import { Sandbox } from 'e2b'
import * as commander from 'commander'

import { spawnConnectedTerminal } from 'src/terminal'
import { asBold, asPrimary } from 'src/utils/format'
import { ensureAPIKey } from '../../api'

export const connectCommand = new commander.Command('connect')
  .description('connect terminal to already running sandbox')
  .argument('<sandboxID>', `connect to sandbox with ${asBold('<sandboxID>')}`)
  .alias('cn')
  .action(async (sandboxID: string) => {
    try {
      const apiKey = ensureAPIKey()

      if (!sandboxID) {
        console.error(
          'You need to specify sandbox ID',
        )
        process.exit(1)
      }

      await connectToSandbox({ apiKey, sandboxID })
      // We explicitly call exit because the sandbox is keeping the program alive.
      // We also don't want to call sandbox.close because that would disconnect other users from the edit session.
      process.exit(0)
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })


async function connectToSandbox({ apiKey, sandboxID }: { apiKey: string, sandboxID: string }) {
  const sandbox = await Sandbox.connect(sandboxID, { apiKey })

    const { exited } = await spawnConnectedTerminal(
      sandbox,
      `Terminal connected to sandbox ${asPrimary(
        sandboxID,
      )}\nwith sandbox ID ${asBold(`${sandbox.sandboxId}`)}`,
      `Disconnecting terminal from sandbox ${asPrimary(
        sandboxID,
      )}`,
    )

    await exited
    console.log(
      `Closing terminal connection to sandbox ${asPrimary(
        sandboxID,
      )}`,
    )
}
