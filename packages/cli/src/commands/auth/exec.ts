import { spawn } from 'node:child_process'
import * as commander from 'commander'

import { ensureAPIKey } from '../../api'

export const execCommand = new commander.Command('exec')
  .description('run a local command with E2B authentication')
  .argument('<command>', 'local command to run')
  .argument('[args...]', 'arguments passed to the command')
  .passThroughOptions()
  .addHelpText(
    'after',
    '\nUse -- before the command when it has options:\n' +
      '  e2b auth exec -- node script.mjs --flag'
  )
  .action(async (command: string, args: string[]) => {
    try {
      process.exitCode = await runAuthenticatedCommand(
        command,
        args,
        ensureAPIKey()
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`e2b: Failed to execute ${command}: ${message}`)
      process.exitCode = 1
    }
  })

export async function runAuthenticatedCommand(
  command: string,
  args: string[],
  apiKey: string
): Promise<number> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, E2B_API_KEY: apiKey },
      stdio: 'inherit',
    })

    child.once('error', reject)
    child.once('close', (code) => resolve(code ?? 1))
  })
}
