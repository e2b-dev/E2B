import { expect } from 'vitest'

import { isDebug, sandboxTest } from '../setup'
import { Sandbox } from '../../src'

// Bash Env Vars
sandboxTest.skipIf(isDebug)(
  'env vars on sandbox (bash)',
  async ({ template }) => {
    const sandbox = await Sandbox.create(template, {
      envs: { TEST_ENV_VAR: 'supertest' },
    })

    try {
      const result = await sandbox.runCode('echo $TEST_ENV_VAR', {
        language: 'bash',
      })

      expect(result.logs.stdout[0]).toEqual('supertest\n')
    } finally {
      await sandbox.kill()
    }
  }
)

sandboxTest('env vars per execution (bash)', async ({ sandbox }) => {
  const result = await sandbox.runCode('echo $FOO', {
    envs: { FOO: 'bar' },
    language: 'bash',
  })

  const result_empty = await sandbox.runCode('echo ${FOO:-default}', {
    language: 'bash',
  })

  expect(result.logs.stdout[0]).toEqual('bar\n')
  expect(result_empty.logs.stdout[0]).toEqual('default\n')
})

sandboxTest.skipIf(isDebug)('env vars overwrite', async ({ template }) => {
  const sandbox = await Sandbox.create(template, {
    envs: { TEST_ENV_VAR: 'supertest' },
  })

  try {
    const result = await sandbox.runCode('echo $TEST_ENV_VAR', {
      language: 'bash',
      envs: { TEST_ENV_VAR: 'overwrite' },
    })

    const result_global_default = await sandbox.runCode('echo $TEST_ENV_VAR', {
      language: 'bash',
    })

    expect(result.logs.stdout[0]).toEqual('overwrite\n')
    expect(result_global_default.logs.stdout[0]).toEqual('supertest\n')
  } finally {
    await sandbox.kill()
  }
})
