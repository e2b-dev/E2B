import { describe, expect } from 'vitest'

import { TimeoutError } from '../../../src'
import { sandboxTest } from '../../setup.js'

sandboxTest(
  'skip shell startup while preserving command environment',
  async ({ sandbox }) => {
    await sandbox.files.write(
      '/tmp/e2b-bash-env',
      'export STARTUP_MARKER=loaded\n'
    )
    const envs = { BASH_ENV: '/tmp/e2b-bash-env', COMMAND_MARKER: 'preserved' }

    const result = await sandbox.commands.run(
      'printf "%s:%s" "${STARTUP_MARKER-unset}" "$COMMAND_MARKER"',
      { shellStartup: 'skip', envs }
    )

    expect(result.stdout).toBe('unset:preserved')
    expect(envs.BASH_ENV).toBe('/tmp/e2b-bash-env')
  }
)

for (const user of ['root', 'user']) {
  sandboxTest(
    `shell startup profiles are optional for ${user}`,
    async ({ sandbox }) => {
      const home = user === 'root' ? '/root' : '/home/user'
      await sandbox.files.write(
        '/etc/profile.d/e2b-startup-test.sh',
        'export SYSTEM_MARKER=loaded\n',
        { user: 'root' }
      )
      await sandbox.files.write(
        `${home}/.bashrc`,
        'export RC_MARKER=loaded\n',
        { user }
      )
      await sandbox.files.write(
        `${home}/.profile`,
        '. "$HOME/.bashrc"; export PROFILE_MARKER=loaded\n',
        { user }
      )
      await sandbox.files.write(
        `${home}/.bash_profile`,
        '. "$HOME/.profile"; export LOGIN_MARKER=loaded\n',
        { user }
      )
      const cmd =
        'printf "%s:%s:%s:%s" "${SYSTEM_MARKER-unset}" "${LOGIN_MARKER-unset}" "${PROFILE_MARKER-unset}" "${RC_MARKER-unset}"'
      for (const shellStartup of [undefined, 'default', 'skip'] as const) {
        const result = await sandbox.commands.run(cmd, { user, shellStartup })
        expect(result.stdout).toBe(
          shellStartup === 'skip'
            ? 'unset:unset:unset:unset'
            : 'loaded:loaded:loaded:loaded'
        )
      }
    }
  )
}

sandboxTest(
  'skip startup preserves cwd, stdin, streams and background exit status',
  async ({ sandbox }) => {
    const stdout: string[] = []
    const stderr: string[] = []
    const handle = await sandbox.commands.run(
      'read -r line; printf "%s:%s" "$PWD" "$line" | cat; printf err >&2; exit 7',
      {
        shellStartup: 'skip',
        cwd: '/tmp',
        stdin: true,
        background: true,
        onStdout: (data) => {
          stdout.push(data)
        },
        onStderr: (data) => {
          stderr.push(data)
        },
      }
    )
    await handle.sendStdin('hello "world"\n')
    await expect(handle.wait()).rejects.toMatchObject({
      exitCode: 7,
      stdout: '/tmp:hello "world"',
      stderr: 'err',
    })
    expect(stdout.join('')).toBe('/tmp:hello "world"')
    expect(stderr.join('')).toBe('err')
  }
)

sandboxTest(
  'skip startup still enforces command timeout',
  async ({ sandbox }) => {
    await expect(
      sandbox.commands.run('sleep 10', { shellStartup: 'skip', timeoutMs: 100 })
    ).rejects.toBeInstanceOf(TimeoutError)
  }
)

describe('sandbox-level BASH_ENV', () => {
  sandboxTest.override({
    sandboxOpts: { envs: { BASH_ENV: '/tmp/e2b-global-bash-env' } },
  })
  sandboxTest(
    'skip overrides inherited BASH_ENV for the command and child Bash',
    async ({ sandbox }) => {
      await sandbox.files.write(
        '/tmp/e2b-global-bash-env',
        'export STARTUP_MARKER=loaded\n'
      )
      const cmd =
        'printf \'%s:\' "${STARTUP_MARKER-unset}"; bash -c \'printf %s "${STARTUP_MARKER-unset}"\''
      expect((await sandbox.commands.run(cmd)).stdout).toBe('loaded:loaded')
      expect(
        (await sandbox.commands.run(cmd, { shellStartup: 'skip' })).stdout
      ).toBe('unset:unset')
    }
  )
})
