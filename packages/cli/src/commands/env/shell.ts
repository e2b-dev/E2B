import * as e2b from '@e2b/sdk'
import * as commander from 'commander'

import { ensureAPIKey } from 'src/api'
import { reqIDArgument } from 'src/arguments'
import { spawnConnectedTerminal } from 'src/terminal'
import { asBold, asFormattedEnvironment, asFormattedError } from 'src/utils/format'

export const shellCommand = new commander.Command('shell')
  .description('Connect terminal to environment')
  .addArgument(reqIDArgument)
  .alias('sh')
  .action(async (id: string) => {
    try {
      const apiKey = ensureAPIKey()

      const env: Pick<e2b.components['schemas']['Environment'], 'envID'> = { envID: id }

      await connectEnvironment({ apiKey, env })
      // We explicitly call exit because the session is keeping the program alive.
      // We also don't want to call session.close because that would disconnect other users from the edit session.
      process.exit(0)
    } catch (err: any) {
      console.error(asFormattedError(err.message))
      process.exit(1)
    }
  })

async function connectEnvironment({
  apiKey,
  env,
}: {
  apiKey: string
  env: Pick<e2b.components['schemas']['Environment'], 'envID'>
}) {
  const session = new e2b.Session({
    apiKey,
    id: env.envID,
  })

  await session.open({})

  if (session.terminal) {
    const { exited } = await spawnConnectedTerminal(
      session.terminal,
      `Terminal connected to environment ${asFormattedEnvironment(
        env,
      )}\nwith session URL ${asBold(`https://${session.getHostname()}`)}`,
      `Disconnecting terminal from environment ${asFormattedEnvironment(env)}`,
    )

    await exited
    console.log(
      `Closing terminal connection to environment ${asFormattedEnvironment(env)}`,
    )
  } else {
    throw new Error('Cannot start terminal - no session')
  }
}
