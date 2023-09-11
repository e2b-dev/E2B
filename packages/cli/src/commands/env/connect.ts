import * as sdk from '@e2b/sdk'
import * as commander from 'commander'

import { ensureAPIKey } from 'src/api'
import { idArgument } from 'src/arguments'
import { getPromptEnv, getRootEnv } from 'src/interactions/envs'
import { pathOption, selectOption } from 'src/options'
import { getRoot } from 'src/utils/filesystem'
import {
  asBold,
  asFormattedEnvironment,
  asFormattedError,
  asLocalRelative,
} from 'src/utils/format'
import { spawnConnectedTerminal } from 'src/terminal'
import { listEnvironments } from './list'

export const connectCommand = new commander.Command('connect')
  .description('Connect terminal to environment')
  .addArgument(idArgument)
  .addOption(selectOption)
  .addOption(pathOption)
  .alias('cn')
  .option('-P, --published', 'Connect to new instance of published environment')
  .option(
    '-L, --local-debug',
    'Connect to existing local environment instance for debugging',
  )
  .action(async (id, opts) => {
    try {
      const apiKey = opts.published ? undefined : ensureAPIKey()
      const root = getRoot(opts.path)

      if (opts.localDebug) {
        await connectEnvironment({ local: true, config: { id: 'local-debug' } })
        return
      }

      let env: sdk.components['schemas']['Environment'] | undefined
      if (id) {
        env = { id }
      } else if (opts.select) {
        const apiKey = ensureAPIKey()
        const envs = await listEnvironments({ apiKey })
        env = await getPromptEnv(envs, 'Select environment to connect to')
      } else {
        env = await getRootEnv(root)
      }

      if (!env) {
        console.log(`No environments found in ${asLocalRelative(root)}`)
        return
      }

      await connectEnvironment({ apiKey, config: env, published: !!opts.published })
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
  published,
  local,
}: {
  apiKey?: string
  local?: boolean
  config: sdk.components['schemas']['Environment']
  published?: boolean
}) {
  const session = new sdk.Session({
    apiKey,
    editEnabled: !published,
    id: config.id,
    ...(local
      ? {
          __debug_devEnv: 'local',
          __debug_hostname: 'localhost',
          __debug_port: 49982,
        }
      : {}),
  })

  await session.open()

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
