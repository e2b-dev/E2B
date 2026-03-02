import * as commander from 'commander'

import { ensureAPIKey } from 'src/api'
import { asBold } from 'src/utils/format'
import * as e2b from 'e2b'
import { NotFoundError } from 'e2b'

async function resumeSandbox(sandboxID: string, apiKey: string) {
  try {
    await e2b.Sandbox.connect(sandboxID, { apiKey })
    console.log(`Sandbox ${asBold(sandboxID)} has been resumed`)
  } catch (err: unknown) {
    if (err instanceof NotFoundError) {
      console.error(`Sandbox ${asBold(sandboxID)} wasn't found`)
    } else {
      throw err
    }
  }
}

export const resumeCommand = new commander.Command('resume')
  .description('resume paused sandbox')
  .argument(
    '<sandboxID>',
    `resume the sandbox specified by ${asBold('<sandboxID>')}`
  )
  .alias('rs')
  .action(async (sandboxID: string) => {
    try {
      const apiKey = ensureAPIKey()
      await resumeSandbox(sandboxID, apiKey)
    } catch (err: unknown) {
      console.error(err)
      process.exit(1)
    }
  })
