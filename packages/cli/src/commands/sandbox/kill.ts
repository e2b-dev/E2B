import * as commander from 'commander'

import { ensureAPIKey } from 'src/api'
import { asBold } from 'src/utils/format'
import * as e2b from 'e2b'
import { Sandbox, components } from 'e2b'
import { parseMetadata } from './utils'

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
    '[sandboxIDs...]',
    `kill the sandboxes specified by ${asBold('[sandboxIDs...]')}`
  )
  .alias('kl')
  .option('-a, --all', 'kill all sandboxes')
  .option(
    '-s, --state <state>',
    'when used with -a/--all flag, filter by state, eg. running, paused. Defaults to running',
    (value) => value.split(',')
  )
  .option(
    '-m, --metadata <metadata>',
    'when used with -a/--all flag, filter by metadata, eg. key1=value1'
  )
  .action(
    async (
      sandboxIDs: string[],
      {
        all,
        state,
        metadata,
      }: {
        all: boolean
        state: components['schemas']['SandboxState'][]
        metadata: string
      }
    ) => {
      try {
        const apiKey = ensureAPIKey()
        const sandboxesState = state || ['running']
        const sandboxesMetadata = parseMetadata(metadata)

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
              state: sandboxesState,
              metadata: sandboxesMetadata,
            },
          })

          while (iterator.hasNext) {
            const sandboxes = await iterator.nextItems()
            total += sandboxes.length

            await Promise.all(
              sandboxes.map((sandbox) => killSandbox(sandbox.sandboxId, apiKey))
            )
          }

          if (total === 0) {
            console.log('No running sandboxes')
          } else {
            console.log(`Killed ${total} running sandboxes`)
          }

          process.exit(0)
        } else {
          await Promise.all(
            sandboxIDs.map((sandboxID) => killSandbox(sandboxID, apiKey))
          )
        }
      } catch (err: any) {
        console.error(err)
        process.exit(1)
      }
    }
  )
