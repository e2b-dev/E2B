import { expect } from 'vitest'

import { isDebug, sandboxTest } from '../setup'
import { Sandbox } from '../../src'

// JavaScript Env Vars
sandboxTest.skipIf(isDebug)(
  'env vars on sandbox (javascript)',
  async ({ template }) => {
    const sandbox = await Sandbox.create(template, {
      envs: { TEST_ENV_VAR: 'supertest' },
    })

    try {
      const result = await sandbox.runCode('process.env.TEST_ENV_VAR', {
        language: 'javascript',
      })

      expect(result.results[0]?.text.trim()).toEqual('supertest')
    } finally {
      await sandbox.kill()
    }
  }
)

sandboxTest('env vars per execution (javascript)', async ({ sandbox }) => {
  const result = await sandbox.runCode('process.env.FOO', {
    envs: { FOO: 'bar' },
    language: 'javascript',
  })

  const result_empty = await sandbox.runCode("process.env.FOO || 'default'", {
    language: 'javascript',
  })

  expect(result.results[0]?.text.trim()).toEqual('bar')
  expect(result_empty.results[0]?.text.trim()).toEqual('default')
})

sandboxTest.skipIf(isDebug)('env vars overwrite', async ({ template }) => {
  const sandbox = await Sandbox.create(template, {
    envs: { TEST_ENV_VAR: 'supertest' },
  })

  try {
    const result = await sandbox.runCode('process.env.TEST_ENV_VAR', {
      language: 'javascript',
      envs: { TEST_ENV_VAR: 'overwrite' },
    })

    const result_global_default = await sandbox.runCode(
      'process.env.TEST_ENV_VAR',
      {
        language: 'javascript',
      }
    )

    expect(result.results[0]?.text.trim()).toEqual('overwrite')
    expect(result_global_default.results[0]?.text.trim()).toEqual('supertest')
  } finally {
    await sandbox.kill()
  }
})
