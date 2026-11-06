import * as commander from '@commander-js/extra-typings'

import { Auth, ensureAuth } from 'src/api'
import { asBold } from 'src/utils/format'
import * as e2b from 'e2b'
import { NotFoundError } from 'e2b'

async function resumeSandbox(sandboxID: string, auth: Auth) {
  try {
    await e2b.Sandbox.connect(sandboxID, auth)
    console.log(`Sandbox ${asBold(sandboxID)} has been resumed`)
  } catch (err: unknown) {
    if (err instanceof NotFoundError) {
      console.error(`Sandbox ${asBold(sandboxID)} wasn't found`)
      process.exit(1)
    }
    throw err
  }
}

export const resumeCommand = new commander.Command('resume')
  .description('resume paused sandbox')
  .argument(
    '<sandboxID>',
    `resume the sandbox specified by ${asBold('<sandboxID>')}`
  )
  .alias('rs')
  .action(async (sandboxID) => {
    try {
      const auth = await ensureAuth()
      await resumeSandbox(sandboxID, auth)
    } catch (err: unknown) {
      console.error(err)
      process.exit(1)
    }
  })
