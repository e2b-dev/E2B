/**
 * Execute a command in a running sandbox.
 *
 * NOTE: Stdin piping (e.g., `echo "data" | e2b exec sandbox cmd`) is not supported.
 * The SDK/envd protocol lacks a way to signal EOF to remote commands. Commands that
 * read until EOF (cat, grep, wc, etc.) would hang indefinitely. This requires envd
 * to add stdin close signaling before it can be implemented.
 */

import * as fs from 'fs'

import { Sandbox, CommandExitError } from 'e2b'
import * as commander from 'commander'

import { ensureAPIKey } from '../../api'
import { setupSignalHandlers } from 'src/utils/signal'

interface ExecOptions {
  background?: boolean
  cwd?: string
  user?: string
  env?: Record<string, string>
}

const NO_COMMAND_TIMEOUT = 0

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
      // Check if stdin is a pipe (data being piped in) - not supported
      try {
        const stdinStats = fs.fstatSync(0)
        if (stdinStats.isFIFO()) {
          console.error('e2b: stdin piping is not supported')
          process.exit(2)
        }
      } catch {
        // fstatSync may fail in some environments, ignore
      }

      const command = commandParts.join(' ')
      try {
        const apiKey = ensureAPIKey()

        const sandbox = await Sandbox.connect(sandboxID, { apiKey })

        if (opts.background) {
          const handle = await sandbox.commands.run(command, {
            background: true,
            cwd: opts.cwd,
            user: opts.user,
            envs: opts.env,
            timeoutMs: NO_COMMAND_TIMEOUT,
          })

          console.error(handle.pid)

          await handle.disconnect()

          // We always exit with code 0 when running in background.
          process.exit(0)
        }

        const exitCode = await runCommand(sandbox, command, opts)

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
  opts: ExecOptions
): Promise<number> {
  const handle = await sandbox.commands.run(command, {
    background: true,
    cwd: opts.cwd,
    user: opts.user,
    envs: opts.env,
    timeoutMs: NO_COMMAND_TIMEOUT,
    onStdout: (data) => {
      try {
        process.stdout.write(data)
      } catch (err: any) {
        console.error(err)
        handle.kill()
      }
    },
    onStderr: (data) => {
      try {
        process.stderr.write(data)
      } catch (err: any) {
        console.error(err)
        handle.kill()
      }
    },
  })

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
