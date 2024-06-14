import * as commander from 'commander'
import * as e2b from 'e2b'

import { asBold } from 'src/utils/format'
import { ensureAPIKey } from '../../api'
import { connectSandbox } from './create'

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


      const sandbox = await e2b.Sandbox.connect(sandboxID, {
        apiKey,
      })

      const refresh = setInterval(async () => {
        await sandbox.setTimeout(15_000)
      }, 5_000)

      console.log(
        `Created sandbox with ID ${asBold(
          `${sandbox.sandboxID}`,
        )}`,
      )

      try {
        await connectSandbox(sandbox)
      } catch (err) {
        await sandbox.kill()
        throw err
      } finally {
        console.log(
          `Closed sandbox with ID ${asBold(
            `${sandbox.sandboxID}`,
          )}`,
        )

        clearInterval(refresh)
      }


      // We explicitly call exit because the sandbox is keeping the program alive.
      // We also don't want to call sandbox.close because that would disconnect other users from the edit session.
      process.exit(0)
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })
