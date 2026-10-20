import * as commander from 'commander'

import { ensureAPIKey } from 'src/api'
import { asBold } from 'src/utils/format'
import * as e2b from 'e2b'
import { NotFoundError, ServiceBusyError } from 'e2b'

async function pauseSandbox(
  sandboxID: string,
  apiKey: string,
  force: boolean | undefined
) {
  try {
    // Left out unless given, so the SDK omits it from the request body.
    const { paused, forced } = await e2b.Sandbox.pause(sandboxID, {
      apiKey,
      ...(force ? { force: true } : {}),
    })
    if (!paused) {
      console.log(`Sandbox ${asBold(sandboxID)} is already paused`)
    } else if (forced) {
      console.log(
        `Sandbox ${asBold(sandboxID)} has been paused with force: the snapshot was taken without the guest agent health check, so its memory may not resume (a reboot resume recovers the disk state)`
      )
    } else {
      console.log(`Sandbox ${asBold(sandboxID)} has been paused`)
    }
  } catch (err: unknown) {
    if (err instanceof NotFoundError) {
      console.error(`Sandbox ${asBold(sandboxID)} wasn't found`)
      process.exit(1)
    }
    if (err instanceof ServiceBusyError) {
      // The API's message says what to do: retry, or pause with --force.
      console.error(err.message)
      process.exit(1)
    }
    throw err
  }
}

export const pauseCommand = new commander.Command('pause')
  .description('pause sandbox')
  .argument(
    '<sandboxID>',
    `pause the sandbox specified by ${asBold('<sandboxID>')}`
  )
  .alias('ps')
  .option(
    '-f, --force',
    'pause even when the sandbox guest agent is unresponsive: the snapshot is taken without the health check and its memory may not resume (a reboot resume recovers the disk state)'
  )
  .action(async (sandboxID: string, { force }: { force?: boolean }) => {
    try {
      const apiKey = ensureAPIKey()
      await pauseSandbox(sandboxID, apiKey, force)
    } catch (err: unknown) {
      console.error(err)
      process.exit(1)
    }
  })
