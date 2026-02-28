import * as commander from 'commander'

import { ensureAPIKey } from 'src/api'
import { asBold } from 'src/utils/format'
import * as e2b from 'e2b'
import { NotFoundError } from 'e2b'

async function pauseSandbox(sandboxID: string, apiKey: string) {
  try {
    const paused = await e2b.Sandbox.betaPause(sandboxID, { apiKey })
    if (paused) {
      console.log(`Sandbox ${asBold(sandboxID)} has been paused`)
    } else {
      console.log(`Sandbox ${asBold(sandboxID)} is already paused`)
    }
  } catch (err: unknown) {
    if (err instanceof NotFoundError) {
      console.error(`Sandbox ${asBold(sandboxID)} wasn't found`)
    } else {
      throw err
    }
  }
}

export const pauseCommand = new commander.Command('pause')
  .description('pause sandbox')
  .argument(
    '<sandboxID>',
    `pause the sandbox specified by ${asBold('<sandboxID>')}`
  )
  .alias('ps')
  .action(async (sandboxID: string) => {
    try {
      const apiKey = ensureAPIKey()
      await pauseSandbox(sandboxID, apiKey)
    } catch (err: unknown) {
      console.error(err)
      process.exit(1)
    }
  })
