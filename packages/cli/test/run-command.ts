import * as commander from 'commander'
import { vi } from 'vitest'

export async function runCommandWithOutput(
  command: commander.Command,
  args: string[] = []
) {
  const program = new commander.Command()
  program.addCommand(command)
  program.exitOverride()

  const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {})

  const output = await new Promise((resolve) => {
    let output = ''

    program.configureOutput({
      writeOut: (str) => (output += str),
      writeErr: (str) => (output += str),
    })

    program
      .parseAsync(['node', ...args], { from: 'node' })
      .then(() => resolve(output))
      .catch(() => {
        resolve(output)
      })
  })

  mockExit.mockRestore()

  return output
}
