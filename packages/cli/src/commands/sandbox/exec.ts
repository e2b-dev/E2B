/**
 * Execute a command in a running sandbox.
 */

import { Sandbox, CommandExitError } from 'e2b'
import * as commander from 'commander'

import { ensureAPIKey, getDomain } from '../../api'
import { setupSignalHandlers } from 'src/utils/signal'
import {
  buildCommand,
  chunkStringByBytes,
  readStdinIfPiped,
} from './exec_helpers'

interface ExecOptions {
  background?: boolean
  cwd?: string
  user?: string
  env?: Record<string, string>
}

const NO_COMMAND_TIMEOUT = 0
const isDebug = (process.env.E2B_DEBUG || 'false').toLowerCase() === 'true'
export const execCommand = new commander.Command('exec')
  .description('execute a command in a running sandbox')
  .argument('<sandboxID>', 'sandbox ID to execute command in')
  .argument('<command...>', 'command to execute')
  .option('-b, --background', 'run in background and return immediately')
  .option('-c, --cwd <dir>', 'working directory')
  .option('-u, --user <user>', 'run as specified user')
  .option(
    '-e, --env <KEY=VALUE>',
    'set environment variable (repeatable)',
    (value: string, previous: Record<string, string>) => {
      const [key, ...rest] = value.split('=')
      if (key && rest.length > 0) {
        previous[key] = rest.join('=')
      }
      return previous
    },
    {} as Record<string, string>
  )
  .alias('ex')
  .action(
    async (sandboxID: string, commandParts: string[], opts: ExecOptions) => {
      // If stdin is a pipe, capture data to stream to the remote command.
      const stdinData = await readStdinIfPiped()

      const command = buildCommand(commandParts)
      try {
        const apiKey = ensureAPIKey()
        const domain = getDomain()
        const sandbox = isDebug
          ? await Sandbox.create({ apiKey, domain })
          : await Sandbox.connect(sandboxID, { apiKey, domain })
        if (isDebug) {
          console.warn(
            `e2b: E2B_DEBUG is enabled, ignoring sandbox ID ${sandboxID}`
          )
        }

        if (opts.background) {
          const handle = await sandbox.commands.run(command, {
            background: true,
            cwd: opts.cwd,
            user: opts.user,
            envs: opts.env,
            stdin: stdinData !== undefined,
            timeoutMs: NO_COMMAND_TIMEOUT,
          })

          if (stdinData) {
            await sendStdin(sandbox, handle.pid, stdinData)
          }

          console.error(handle.pid)

          await handle.disconnect()

          // We always exit with code 0 when running in background.
          process.exit(0)
        }

        const exitCode = await runCommand(sandbox, command, opts, stdinData)

        process.exit(exitCode)
      } catch (err: any) {
        console.error(err)
        process.exit(1)
      }
    }
  )

async function runCommand(
  sandbox: Sandbox,
  command: string,
  opts: ExecOptions,
  stdinData?: string
): Promise<number> {
  const handle = await sandbox.commands.run(command, {
    background: true,
    cwd: opts.cwd,
    user: opts.user,
    envs: opts.env,
    stdin: stdinData !== undefined,
    timeoutMs: NO_COMMAND_TIMEOUT,
    onStdout: async (data) => {
      try {
        process.stdout.write(data)
      } catch (err: any) {
        console.error(err)
        await handle.kill()
      }
    },
    onStderr: async (data) => {
      try {
        process.stderr.write(data)
      } catch (err: any) {
        console.error(err)
        await handle.kill()
      }
    },
  })

  if (stdinData !== undefined) {
    await sendStdin(sandbox, handle.pid, stdinData)
  }

  const removeSignalHandlers = setupSignalHandlers(async () => {
    // Kill the remote process - main loop handles exit code.
    await handle.kill()
  })

  try {
    const result = await handle.wait()

    return result.exitCode
  } catch (err) {
    if (handle.error) {
      console.error(handle.error)
    }

    if (err instanceof CommandExitError) {
      return err.exitCode
    }

    // If exit code is not from the command we throw the error.
    throw err
  } finally {
    removeSignalHandlers()
  }
}

async function sendStdin(
  sandbox: Sandbox,
  pid: number,
  data: string
): Promise<void> {
  const chunkSizeBytes = 64 * 1024
  const chunks = chunkStringByBytes(data, chunkSizeBytes)
  for (const chunk of chunks) {
    await sandbox.commands.sendStdin(pid, chunk)
  }
  // Signal EOF so commands like cat/wc/grep terminate.
  // Silently ignore if the envd version doesn't support CloseStdin yet.
  try {
    await sandbox.commands.closeStdin(pid)
  } catch {
    // envd doesn't support CloseStdin — fall back to best-effort behavior
  }
}
