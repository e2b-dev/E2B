import * as e2b from 'e2b'
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
        console.error('You need to specify sandbox ID')
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

async function connectToSandbox({
  apiKey,
  sandboxID,
}: {
  apiKey: string
  sandboxID: string
}) {
  const sandbox = await e2b.Sandbox.connect(sandboxID, { apiKey })

  console.log(
    `Terminal connecting to sandbox ${asPrimary(`${sandbox.sandboxId}`)}`
  )
  await spawnConnectedTerminal(sandbox)
  console.log(
    `Closing terminal connection to sandbox ${asPrimary(sandbox.sandboxId)}`
  )
}
