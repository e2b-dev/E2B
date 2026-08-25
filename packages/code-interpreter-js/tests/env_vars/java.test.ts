import { expect } from 'vitest'

import { isDebug, sandboxTest } from '../setup'
import { Sandbox } from '../../src'

// Java Env Vars
sandboxTest.skipIf(isDebug)(
  'env vars on sandbox (java)',
  async ({ template }) => {
    const sandbox = await Sandbox.create(template, {
      envs: { TEST_ENV_VAR: 'supertest' },
    })

    try {
      const result = await sandbox.runCode(
        'System.getProperty("TEST_ENV_VAR")',
        {
          language: 'java',
        }
      )

      expect(result.results[0]?.text.trim()).toEqual('supertest')
    } finally {
      await sandbox.kill()
    }
  }
)

sandboxTest('env vars per execution (java)', async ({ sandbox }) => {
  const result = await sandbox.runCode('System.getProperty("FOO")', {
    envs: { FOO: 'bar' },
    language: 'java',
  })

  const result_empty = await sandbox.runCode(
    'System.getProperty("FOO", "default")',
    {
      language: 'java',
    }
  )

  expect(result.results[0]?.text.trim()).toEqual('bar')
  expect(result_empty.results[0]?.text.trim()).toEqual('default')
})

sandboxTest.skipIf(isDebug)('env vars overwrite', async ({ template }) => {
  const sandbox = await Sandbox.create(template, {
    envs: { TEST_ENV_VAR: 'supertest' },
  })

  try {
    const result = await sandbox.runCode('System.getProperty("TEST_ENV_VAR")', {
      language: 'java',
      envs: { TEST_ENV_VAR: 'overwrite' },
    })

    const result_global_default = await sandbox.runCode(
      'System.getProperty("TEST_ENV_VAR")',
      {
        language: 'java',
      }
    )

    expect(result.results[0]?.text.trim()).toEqual('overwrite')
    expect(result_global_default.results[0]?.text.trim()).toEqual('supertest')
  } finally {
    await sandbox.kill()
  }
})
