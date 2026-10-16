import { assert } from 'vitest'
import { sandboxTest } from '../../setup.js'

sandboxTest(
  'streaming command delivers output only to callbacks',
  async ({ sandbox }) => {
    let stdout = ''
    let stderr = ''
    const cmd = await sandbox.commands.startStreaming(
      'echo out; echo err >&2',
      {
        onStdout: (data) => {
          stdout += data
        },
        onStderr: (data) => {
          stderr += data
        },
      }
    )

    const result = await cmd.wait()

    assert.equal(stdout, 'out\n')
    assert.equal(stderr, 'err\n')
    assert.equal(cmd.stdout, '')
    assert.equal(cmd.stderr, '')
    assert.equal(result.exitCode, 0)
  }
)
