import * as sdk from '@e2b/sdk'
import * as commander from 'commander'
import { ensureAPIKey } from 'src/api'
import { idArgument } from 'src/arguments'
import { pathOption, selectOption } from 'src/options'
import { spawnConnectedTerminal } from 'src/terminal'
import { getRoot } from 'src/utils/filesystem'
import {
  asBold,
  asFormattedEnvironment,
  asFormattedError,
  asLocalRelative,
} from 'src/utils/format'

export const shellCommand = new commander.Command('shell')
  .description('Connect terminal to environment')
  .addArgument(idArgument)
  .addOption(selectOption)
  .addOption(pathOption)
  .alias('cn')
  .option(
    '-L, --local-debug',
    'Connect to existing local environment instance for debugging',
  )
  .action(async (id, opts) => {
    try {
      const apiKey = ensureAPIKey()
      const root = getRoot(opts.path)

      if (opts.localDebug) {
        await connectEnvironment({ apiKey, local: true, config: { id: 'local-debug' } })
        return
      }

      // let env: sdk.components['schemas']['Environment'] | undefined
      let env: any
      if (id) {
        env = { id }
      } else if (opts.select) {
        throw new Error('Selecting is not yet implemented')
        // const apiKey = ensureAPIKey()
        // const envs = await listEnvironments({ apiKey })
        // env = await getPromptEnv(envs, 'Select environment to connect to')
      } else {
        throw new Error('No environment ID provided, use "e2b env shell --id <envID>"')
        // env = await getRootEnv(root)
      }

      if (!env) {
        console.log(`No environments found in ${asLocalRelative(root)}`)
        return
      }

      await connectEnvironment({ apiKey, config: env })
      // We explicitly call exit because the session is keeping the program alive.
      // We also don't want to call session.close because that would disconnect other users from the edit session.
      process.exit(0)
    } catch (err: any) {
      console.error(asFormattedError(err.message))
      process.exit(1)
    }
  })

export async function connectEnvironment({
  apiKey,
  config,
  local,
}: {
  apiKey: string
  local?: boolean
  config: sdk.components['schemas']['Environment']
}) {
  const session = new sdk.Session({
    apiKey,
    id: config.id,
    ...(local
      ? {
          __debug_devEnv: 'local',
          __debug_hostname: 'localhost',
          __debug_port: 49982,
        }
      : {}),
  })

  await session.open({})

  if (session.terminal) {
    const { exited } = await spawnConnectedTerminal(
      session.terminal,
      `Terminal connected to environment ${asFormattedEnvironment(
        config,
      )}\nwith session URL ${asBold(`https://${session.getHostname()}`)}`,
      `Disconnecting terminal from environment ${asFormattedEnvironment(config)}`,
    )

    await exited
    console.log(
      `Closing terminal connection to environment ${asFormattedEnvironment(config)}`,
    )
  } else {
    throw new Error('Cannot start terminal - no session')
  }
}
