import * as e2b from 'e2b'
import * as commander from 'commander'
import * as path from 'path'

import { ensureAPIKey } from 'src/api'
import { asBold, asFormattedSandboxTemplate } from 'src/utils/format'
import { getRoot } from '../../utils/filesystem'
import { getConfigPath, loadConfig } from '../../config'
import fs from 'fs'
import { configOption, pathOption } from '../../options'

export const createCommand = new commander.Command('create')
  .description('create sandbox and connect terminal to it')
  .argument(
    '[template]',
    `create and connect to sandbox specified by ${asBold('[template]')}`,
  )
  .addOption(pathOption)
  .addOption(configOption)
  .alias('cr')
  .action(
    async (
      template: string | undefined,
      opts: {
        name?: string
        path?: string
        config?: string
      },
    ) => {
      try {
        const apiKey = ensureAPIKey()
        let templateID = template

        const root = getRoot(opts.path)
        const configPath = getConfigPath(root, opts.config)

        const config = fs.existsSync(configPath)
          ? await loadConfig(configPath)
          : undefined
        const relativeConfigPath = path.relative(root, configPath)

        if (!templateID && config) {
          console.log(
            `Found sandbox template ${asFormattedSandboxTemplate(
              {
                templateID: config.template_id,
                aliases: config.template_name
                  ? [config.template_name]
                  : undefined,
              },
              relativeConfigPath,
            )}`,
          )
          templateID = config.template_id
        }

        if (!templateID) {
          console.error(
            'You need to specify sandbox template ID or path to sandbox template config',
          )
          process.exit(1)
        }

        const sandbox = await e2b.Sandbox.create(templateID, {
          apiKey,
          timeoutMs: 15_000,
        })

        const refresh = setInterval(async () => {
          await sandbox.setTimeout(15_000)
        }, 5_000)

        console.log(
          `Created sandbox with ID ${asBold(
            `${sandbox.sandboxID}`,
          )}`,
        )

        try {
          await connectSandbox(sandbox)
        } catch (err) {
          await sandbox.kill()
          throw err
        } finally {
          console.log(
            `Closed sandbox with ID ${asBold(
              `${sandbox.sandboxID}`,
            )}`,
          )

          clearInterval(refresh)
        }

        // We explicitly call exit because the sandbox is keeping the program alive.
        // We also don't want to call sandbox.close because that would disconnect other users from the edit session.
        process.exit(0)
      } catch (err: any) {
        console.error(err)
        process.exit(1)
      }
    },
  )

export async function connectSandbox(sandbox: e2b.Sandbox) {
  // Clear local terminal emulator before starting terminal
  // process.stdout.write('\x1b[2J\x1b[0f')

  process.stdin.setEncoding('binary')
  process.stdin.setRawMode(true)

  process.stdout.setEncoding('binary')

  const { cols, rows } = getStdoutSize()

  const terminal = await sandbox.pty.create({
    cols,
    rows,
    onData: (data) => {
      process.stdout.write(data)
    },
    timeout: 0,
  })

  const terminalInput = await sandbox.pty.streamInput(terminal.pid, {
    timeout: 0,
  })

  const resizeListener = process.stdout.on('resize', () =>
    sandbox.pty.resize(terminal.pid, getStdoutSize()),
  )

  const stdinListener = process.stdin.on('data', (data) =>
    terminalInput.sendData(data),
  )

  await terminal.wait()

  resizeListener.destroy()
  stdinListener.destroy()

  console.log(
    `Disconnected terminal from sandbox with ID ${asBold(
      `${sandbox.sandboxID}`,
    )
    } `,
  )
}

function getStdoutSize() {
  return {
    cols: process.stdout.columns,
    rows: process.stdout.rows,
  }
}
