/**
 * Execute a command in a running sandbox.
 */

import { Sandbox, CommandExitError, NotFoundError } from 'e2b'
import * as commander from 'commander'

import { ensureAPIKey } from '../../api'
import { setupSignalHandlers } from 'src/utils/signal'
import { buildCommand, isPipedStdin, streamStdinChunks } from './exec_helpers'

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
      const hasPipedStdin = isPipedStdin()

      const command = buildCommand(commandParts)
      try {
        const apiKey = ensureAPIKey()
        const sandbox = await Sandbox.connect(sandboxID, { apiKey })

        if (hasPipedStdin && !sandbox.commands.supportsStdinClose) {
          console.error(
            'e2b: Warning: Piped stdin is not supported by this sandbox version.\n' +
              'e2b: Rebuild your template to pick up the latest sandbox version.\n' +
              'e2b: Ignoring piped stdin.'
          )
        }

        const canPipeStdin =
          hasPipedStdin && sandbox.commands.supportsStdinClose

        if (opts.background) {
          const handle = await sandbox.commands.run(command, {
            background: true,
            cwd: opts.cwd,
            user: opts.user,
            envs: opts.env,
            timeoutMs: NO_COMMAND_TIMEOUT,
            ...(canPipeStdin ? { stdin: true } : {}),
          })

          const removeSignalHandlers = setupSignalHandlers(async () => {
            await handle.kill()
          })

          try {
            if (canPipeStdin) {
              await sendStdin(sandbox, handle.pid)
            }
          } finally {
            removeSignalHandlers()
          }

          console.error(handle.pid)

          await handle.disconnect()

          // We always exit with code 0 when running in background.
          process.exit(0)
        }

        const exitCode = await runCommand(sandbox, command, opts, canPipeStdin)

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
  openStdin: boolean
): Promise<number> {
  const handle = await sandbox.commands.run(command, {
    background: true,
    cwd: opts.cwd,
    user: opts.user,
    envs: opts.env,
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
    ...(openStdin ? { stdin: true } : {}),
  })

  const removeSignalHandlers = setupSignalHandlers(async () => {
    // Kill the remote process - main loop handles exit code.
    await handle.kill()
  })

  try {
    if (openStdin) {
      await sendStdin(sandbox, handle.pid)
    }

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

async function sendStdin(sandbox: Sandbox, pid: number): Promise<void> {
  const chunkSizeBytes = 64 * 1024
  let processExited = false

  await streamStdinChunks(
    process.stdin,
    async (chunk) => {
      if (processExited) {
        return false
      }

      try {
        await sandbox.commands.sendStdin(pid, chunk)
      } catch (err) {
        if (err instanceof NotFoundError) {
          processExited = true
          console.error(
            'e2b: Remote command exited before stdin could be delivered.'
          )
          return false
        }
        throw err
      }
    },
    chunkSizeBytes
  )

  if (processExited) {
    return
  }

  // Signal EOF so commands like cat/wc/grep terminate.
  try {
    await sandbox.commands.closeStdin(pid)
  } catch (err) {
    if (err instanceof NotFoundError) {
      // Process already exited — EOF is moot.
      return
    }

    // Fail fast, and avoid leaking a process blocked on stdin.
    await killProcessBestEffort(sandbox, pid)
    throw err
  }
}

async function killProcessBestEffort(
  sandbox: Sandbox,
  pid: number
): Promise<void> {
  try {
    await sandbox.commands.kill(pid)
  } catch (killErr) {
    console.error(
      'e2b: Failed to kill remote process after stdin EOF signaling failed.'
    )
    console.error(killErr)
  }
}
