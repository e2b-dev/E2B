import * as commander from 'commander'

import { ensureAPIKey } from 'src/api'
import { asBold } from 'src/utils/format'
import * as e2b from 'e2b'


const killSandbox = e2b.withAPIKey(
  e2b.api.path('/sandboxes/{sandboxID}').method('delete').create(),
)
export const killCommand = new commander.Command('shell')
  .description('Kill sandbox')
  .argument('<sandboxID>', `Kill the sandbox specified by ${asBold('<sandboxID>')}`)
  .alias('kl')
  .action(async (sandboxID: string) => {
    try {
      const apiKey = ensureAPIKey()

      if (!sandboxID) {
        console.error(
          `You need to specify sandbox ID`,
        )
        process.exit(1)
      }

      await killSandbox(  apiKey, { sandboxID } )
      // We explicitly call exit because the sandbox is keeping the program alive.
      // We also don't want to call sandbox.close because that would disconnect other users from the edit session.
      process.exit(0)
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })
