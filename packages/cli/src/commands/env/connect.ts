import * as sdk from '@devbookhq/sdk'
import * as commander from 'commander'

import { ensureAPIKey } from 'src/api'
import { idArgument } from 'src/arguments'
import { handleExit } from 'src/handleExit'
import { getPromptEnv, getRootEnv } from 'src/interactions/envs'
import { pathOption, selectOption } from 'src/options'
import { getRoot } from 'src/utils/filesystem'
import {
  asBold,
  asFormattedEnvironment,
  asFormattedError,
  asLocalRelative,
} from 'src/utils/format'
import { createDeferredPromise } from 'src/utils/promise'
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
      const apiKey = ensureAPIKey()
      const root = getRoot(opts.path)

      if (opts.localDebug) {
        await connectEnvironment({ local: true, config: { id: 'local-debug' } })
        return
      }

      let env: sdk.components['schemas']['Environment'] | undefined
      if (id) {
        env = { id }
      } else if (opts.select) {
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
    } catch (err: any) {
      console.error(asFormattedError(err.message))
      process.exit(1)
    }
  })

function getStdoutSize() {
  return {
    cols: process.stdout.columns,
    rows: process.stdout.rows,
  }
}

async function spawnConnectedTerminal(
  manager: sdk.TerminalManager,
  introText: string,
  exitText: string,
) {
  const { promise: exited, resolve: onExit } = createDeferredPromise()

  // Clear local terminal emulator before starting terminal
  // process.stdout.write('\x1b[2J\x1b[0f')

  console.log(introText)

  const terminal = await manager.createSession({
    onData: data => process.stdout.write(data),
    size: getStdoutSize(),
    onExit,
    envVars: {
      TERM: 'xterm-256color',
    },
  })

  process.stdin.setEncoding('utf8')
  process.stdin.setRawMode(true)

  process.stdout.setEncoding('utf8')

  const resizeListener = process.stdout
    .unref()
    .on('resize', () => terminal.resize(getStdoutSize()))

  const stdinListener = process.stdin
    .unref()
    .on('data', data => terminal.sendData(data.toString('utf8')))

  exited.then(() => {
    console.log(exitText)
    resizeListener.destroy()
    stdinListener.destroy()
  })

  return {
    destroy: terminal.destroy.bind(terminal),
    exited,
  }
}

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

  try {
    await session.open()

    if (session.terminal) {
      const { exited, destroy } = await spawnConnectedTerminal(
        session.terminal,
        `Terminal connected to environment ${asFormattedEnvironment(
          config,
        )}\nwith session URL ${asBold(`https://${session.getHostname()}`)}`,
        `Disconnecting terminal from environment ${asFormattedEnvironment(config)}`,
      )

      handleExit(async () => {
        await destroy()
        await session.close()
      })

      await exited
      console.log(
        `Closing terminal connection to environment ${asFormattedEnvironment(config)}`,
      )
      await destroy()
    } else {
      throw new Error('Cannot start terminal - no session')
    }

    console.log(`Closing environment ${asFormattedEnvironment(config)}`)
    await session.close()
  } finally {
    // Don't call close - the edit session is shared so we don't want to close it.
    // await session.close()
  }
}
