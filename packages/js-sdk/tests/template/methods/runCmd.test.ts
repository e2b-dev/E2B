import { randomUUID } from 'node:crypto'
import { expect, test } from 'vitest'
import { Template } from '../../../src'

test('run command', { timeout: 180000 }, async () => {
  const template = Template().fromImage('ubuntu:22.04').runCmd('ls -l')

  await Template.build(template, {
    alias: randomUUID(),
  })
})

test('run command as a different user', { timeout: 180000 }, async () => {
  const template = Template()
    .fromImage('ubuntu:22.04')
    .runCmd('test "$(whoami)" = "root"', { user: 'root' })

  await Template.build(template, {
    alias: randomUUID(),
  })
})

test(
  'run command as user that does not exist',
  { timeout: 180000 },
  async () => {
    const template = Template()
      .fromImage('ubuntu:22.04')
      .runCmd('whoami', { user: 'root123' })

    await expect(
      Template.build(template, {
        alias: randomUUID(),
      })
    ).rejects.toThrow(
      "failed to run command 'whoami': command failed: unauthenticated: invalid username: 'root123'"
    )
  }
)
