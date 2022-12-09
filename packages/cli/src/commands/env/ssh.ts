import * as sdk from '@devbookhq/sdk'
import * as commander from 'commander'

import { ensureAPIKey } from 'src/api'
import { envPathArgument } from 'src/arguments'
import { getPromptEnv, getRootEnv } from 'src/interactions/envs'
import { idOption, selectOption } from 'src/options'
import { createDeferredPromise } from 'src/utils/createDeferredPromise'
import { getRoot } from 'src/utils/filesystem'
import { listEnvironments } from './list'

export const sshCommand = new commander.Command('ssh')
  .description('SSH into an environment')
  .addArgument(envPathArgument)
  .addOption(selectOption)
  .addOption(idOption)
  .option(
    '-p, --published',
    'SSH into a newly created published environment. Any changes will not be persisted',
  )
  .action(async (envPath, cmdObj) => {
    try {
      const apiKey = ensureAPIKey()
      const root = getRoot()

      let env: sdk.components['schemas']['Environment'] | undefined
      if (cmdObj.id) {
        env = cmdObj.id
      } else if (cmdObj.select) {
        const envs = await listEnvironments({ apiKey })
        env = await getPromptEnv(envs)
      } else {
        env = await getRootEnv(root)
      }

      if (!env) {
        console.log('No environment found')
        return
      }

      await sshEnvironment({ apiKey, id: env.id, published: !!cmdObj.published })

      console.log('Done')

      // We explicitly call exit because the session is keeping the program alive.
      // We also don't want to call session.close because that would disconnect other users from the edit session.
      process.exit(0)
    } catch (err) {
      console.error(err)
      process.exit(1)
    }
  })

function getStdoutSize() {
  return {
    cols: process.stdout.columns,
    rows: process.stdout.rows,
  }
}

async function spawnConnectedTerminal(manager: sdk.TerminalManager) {
  const { promise: exited, resolve: onExit } = createDeferredPromise()

  // Clear local terminal emulator before starting terminal
  // process.stdout.write('\x1b[2J\x1b[0f')

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

export async function sshEnvironment({
  apiKey,
  id,
  published,
}: {
  apiKey: string
  id: string
  published: boolean
}) {
  const session = new sdk.Session({
    apiKey,
    editEnabled: !published,
    id,
  })

  try {
    await session.open()

    if (session.terminal) {
      const { exited } = await spawnConnectedTerminal(session.terminal)

      await exited
    } else {
      console.error('Cannot retrieve session terminal manager')
    }
  } finally {
    // Don't call close - the edit session is shared so we don't want to close it.
    // await session.close()
  }
}
