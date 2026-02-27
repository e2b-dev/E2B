import * as commander from 'commander'

import { ensureAPIKey } from 'src/api'
import { asBold } from 'src/utils/format'
import * as e2b from 'e2b'
import { Sandbox } from 'e2b'

async function pauseSandbox(sandboxID: string, apiKey: string) {
  try {
    await e2b.Sandbox.betaPause(sandboxID, { apiKey })
    console.log(`Sandbox ${asBold(sandboxID)} has been paused`)
  } catch (err: any) {
    if (err.message?.includes('not found')) {
      console.error(`Sandbox ${asBold(sandboxID)} wasn't found`)
    } else if (err.message?.includes('already paused')) {
      console.error(`Sandbox ${asBold(sandboxID)} is already paused`)
    } else {
      throw err
    }
  }
}

export const pauseCommand = new commander.Command('pause')
  .description('pause sandbox')
  .argument(
    '[sandboxIDs...]',
    `pause the sandboxes specified by ${asBold('[sandboxIDs...]')}`
  )
  .alias('ps')
  .option('-a, --all', 'pause all running sandboxes')
  .action(
    async (
      sandboxIDs: string[],
      {
        all,
      }: {
        all: boolean
      }
    ) => {
      try {
        const apiKey = ensureAPIKey()

        if ((!sandboxIDs || sandboxIDs.length === 0) && !all) {
          console.error(
            `You need to specify ${asBold('[sandboxIDs...]')} or use ${asBold(
              '-a/--all'
            )} flag`
          )
          process.exit(1)
        }

        if (all && sandboxIDs && sandboxIDs.length > 0) {
          console.error(
            `You cannot use ${asBold(
              '-a/--all'
            )} flag while specifying ${asBold('[sandboxIDs...]')}`
          )
          process.exit(1)
        }

        if (all) {
          let total = 0
          const iterator = Sandbox.list({
            apiKey,
            query: {
              state: ['running'],
            },
          })

          while (iterator.hasNext) {
            const sandboxes = await iterator.nextItems()
            total += sandboxes.length

            await Promise.all(
              sandboxes.map((sandbox) => pauseSandbox(sandbox.sandboxId, apiKey))
            )
          }

          if (total === 0) {
            console.log('No running sandboxes to pause')
          } else {
            console.log(`Paused ${total} running sandboxes`)
          }

          process.exit(0)
        } else {
          await Promise.all(
            sandboxIDs.map((sandboxID) => pauseSandbox(sandboxID, apiKey))
          )
        }
      } catch (err: any) {
        console.error(err)
        process.exit(1)
      }
    }
  )
