import * as commander from 'commander'

import { ensureAPIKey } from 'src/api'
import { asBold } from 'src/utils/format'
import * as e2b from 'e2b'


const killSandbox = e2b.withAPIKey(
  e2b.api.path('/sandboxes/{sandboxID}').method('delete').create(),
)
export const killCommand = new commander.Command('kill')
  .description('kill sandbox')
  .argument('<sandboxID>', `kill the sandbox specified by ${asBold('<sandboxID>')}`)
  .alias('kl')
  .action(async (sandboxID: string) => {
    try {
      const apiKey = ensureAPIKey()

      if (!sandboxID) {
        console.error('You need to specify sandbox ID')
        process.exit(1)
      }

      await killSandbox(apiKey, { sandboxID })

      console.log(`Sandbox ${asBold(sandboxID)} has been killed`)
    } catch (err: any) {
      if (err?.status === 404) {
        console.error(`Sandbox ${asBold(sandboxID)} wasn't found`)
      } else {
        console.error(err)
      }
      process.exit(1)
    }
  })
