import * as commander from 'commander'

import { ensureAPIKey } from 'src/api'
import { asBold } from 'src/utils/format'
import * as e2b from 'e2b'

async function killSandbox(sandboxID: string, apiKey: string) {
  const killed = await e2b.Sandbox.kill(sandboxID, { apiKey })
  if (killed) {
    console.log(`Sandbox ${asBold(sandboxID)} has been killed`)
  } else {
    console.error(`Sandbox ${asBold(sandboxID)} wasn't found`)
  }
}

export const killCommand = new commander.Command('kill')
  .description('kill sandbox')
  .argument(
    '[sandboxID]',
    `kill the sandbox specified by ${asBold('[sandboxID]')}`
  )
  .alias('kl')
  .option('-a, --all', 'kill all running sandboxes')
  .action(async (sandboxID: string, { all }: { all: boolean }) => {
    try {
      const apiKey = ensureAPIKey()

      if (!sandboxID && !all) {
        console.error(
          `You need to specify ${asBold('[sandboxID]')} or use ${asBold(
            '-a/--all'
          )} flag`
        )
        process.exit(1)
      }

      if (all && sandboxID) {
        console.error(
          `You cannot use ${asBold('-a/--all')} flag while specifying ${asBold(
            '[sandboxID]'
          )}`
        )
        process.exit(1)
      }

      if (all) {
        const sandboxes = await e2b.Sandbox.list({ apiKey })

        if (sandboxes.length === 0) {
          console.log('No sandboxes found')
          process.exit(0)
        }

        await Promise.all(
          sandboxes.map((sandbox) => killSandbox(sandbox.sandboxId, apiKey))
        )
      } else {
        await killSandbox(sandboxID, apiKey)
      }
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })
