import * as sdk from '@devbookhq/sdk'
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
import { createDeferredPromise } from 'src/utils/promise'
import { listEnvironments } from './list'

export const connectCommand = new commander.Command('connect')
  .description('Connect terminal to environment')
  .addArgument(idArgument)
  .addOption(selectOption)
  .addOption(pathOption)
  .alias('cn')
  .option('-P, --published', 'Connect to new instance of published environment')
  .action(async (id, opts) => {
    try {
      const apiKey = ensureAPIKey()
      const root = getRoot(opts.path)

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

      // We explicitly call exit because the session is keeping the program alive.
      // We also don't want to call session.close because that would disconnect other users from the edit session.
      process.exit(0)
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

  const oldStdinEncoding = process.stdin.readableEncoding
  const oldRawMode = process.stdin.isRaw

  process.stdin.setEncoding('utf8')
  process.stdin.setRawMode(true)

  const oldStdoutEncoding = process.stdout.readableEncoding
  process.stdout.setEncoding('utf8')

  const resizeListener = process.stdout.on('resize', () =>
    terminal.resize(getStdoutSize()),
  )

  const stdinListener = process.stdin.on('data', data =>
    terminal.sendData(data.toString('utf8')),
  )

  exited.then(() => {
    console.log(exitText)
    resizeListener.destroy()
    stdinListener.destroy()
    if (oldStdinEncoding) {
      process.stdin.setEncoding(oldStdinEncoding)
    }
    if (oldStdoutEncoding) {
      process.stdin.setEncoding(oldStdoutEncoding)
    }
    process.stdin.setRawMode(oldRawMode)
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
}: {
  apiKey: string
  config: sdk.components['schemas']['Environment']
  published: boolean
}) {
  const session = new sdk.Session({
    apiKey,
    editEnabled: !published,
    id: config.id,
  })

  try {
    await session.open()

    if (session.terminal) {
      const { exited } = await spawnConnectedTerminal(
        session.terminal,
        `Terminal connected to environment ${asFormattedEnvironment(
          config,
        )}\nWith session URL ${asBold(`https://${session.getHostname()}`)}`,
        `Disconnected terminal from environment ${asFormattedEnvironment(config)}`,
      )

      await exited
    } else {
      throw new Error('Cannot start terminal - no session')
    }
  } finally {
    // Don't call close - the edit session is shared so we don't want to close it.
    // await session.close()
  }
}
