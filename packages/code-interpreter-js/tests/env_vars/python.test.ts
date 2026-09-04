import { expect } from 'vitest'

import { isDebug, sandboxTest } from '../setup'
import { Sandbox } from '../../src'

// Python Env Vars
sandboxTest.skipIf(isDebug)(
  'env vars on sandbox (python)',
  async ({ template }) => {
    const sandbox = await Sandbox.create(template, {
      envs: { TEST_ENV_VAR: 'supertest' },
    })

    try {
      const result = await sandbox.runCode(
        'import os; os.getenv("TEST_ENV_VAR")',
        {
          language: 'python',
        }
      )

      expect(result.results[0]?.text.trim()).toEqual('supertest')
    } finally {
      await sandbox.kill()
    }
  }
)

sandboxTest('env vars per execution (python)', async ({ sandbox }) => {
  const result = await sandbox.runCode('import os; os.getenv("FOO")', {
    envs: { FOO: 'bar' },
    language: 'python',
  })

  const result_empty = await sandbox.runCode(
    "import os; os.getenv('FOO', 'default')",
    {
      language: 'python',
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
    const result = await sandbox.runCode(
      'import os; os.getenv("TEST_ENV_VAR")',
      {
        language: 'python',
        envs: { TEST_ENV_VAR: 'overwrite' },
      }
    )

    const result_global_default = await sandbox.runCode(
      'import os; os.getenv("TEST_ENV_VAR")',
      {
        language: 'python',
      }
    )

    expect(result.results[0]?.text.trim()).toEqual('overwrite')
    expect(result_global_default.results[0]?.text.trim()).toEqual('supertest')
  } finally {
    await sandbox.kill()
  }
})
