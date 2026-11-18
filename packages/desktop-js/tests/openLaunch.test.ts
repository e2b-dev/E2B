import { execFileSync } from 'node:child_process'
import { expect, test } from 'vitest'

import { Sandbox } from '../src'

// Commands run in the sandbox through `/bin/bash -l -c <cmd>`. Run the command
// the SDK builds through bash with `xdg-open` / `gtk-launch` replaced by a
// function that prints each argument it receives, one per line.
function argvSeenBy(program: string, command: string): string[] {
  const stub = `${program}() { printf '%s\\n' "$@"; }; `
  return execFileSync('bash', ['-c', stub + command], { encoding: 'utf8' })
    .split('\n')
    .filter((line) => line.length > 0)
}

function recordingSandbox(): { sandbox: Sandbox; commands: string[] } {
  const commands: string[] = []
  const sandbox = Object.create(Sandbox.prototype) as Sandbox
  Object.defineProperty(sandbox, 'commands', {
    value: {
      run: async (cmd: string) => {
        commands.push(cmd)
        return { disconnect: async () => {} }
      },
    },
  })
  return { sandbox, commands }
}

const skipOnWindows = test.skipIf(process.platform === 'win32')

skipOnWindows(
  'open passes a URL with a query string as one argument',
  async () => {
    const { sandbox, commands } = recordingSandbox()
    const url = 'https://example.com/search?q=e2b&page=2#results'

    await sandbox.open(url)

    expect(commands).toHaveLength(1)
    expect(argvSeenBy('xdg-open', commands[0])).toEqual([url])
  }
)

skipOnWindows(
  'open passes a file path with spaces and quotes as one argument',
  async () => {
    const { sandbox, commands } = recordingSandbox()
    const path = "/home/user/Q3 report (Bob's copy).pdf"

    await sandbox.open(path)

    expect(argvSeenBy('xdg-open', commands[0])).toEqual([path])
  }
)

skipOnWindows(
  'launch passes the application and the URI as separate arguments',
  async () => {
    const { sandbox, commands } = recordingSandbox()
    const uri = 'https://example.com/?a=1&b=2'

    await sandbox.launch('google-chrome', uri)

    expect(argvSeenBy('gtk-launch', commands[0])).toEqual([
      'google-chrome',
      uri,
    ])
  }
)

skipOnWindows('launch without a URI passes only the application', async () => {
  const { sandbox, commands } = recordingSandbox()

  await sandbox.launch('google-chrome')

  expect(argvSeenBy('gtk-launch', commands[0])).toEqual(['google-chrome'])
})
