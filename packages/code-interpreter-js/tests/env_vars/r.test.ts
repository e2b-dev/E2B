import { expect } from 'vitest'

import { isDebug, sandboxTest } from '../setup'
import { Sandbox } from '../../src'

// R Env Vars
sandboxTest.skipIf(isDebug)('env vars on sandbox (R)', async ({ template }) => {
  const sandbox = await Sandbox.create(template, {
    envs: { TEST_ENV_VAR: 'supertest' },
  })

  try {
    const result = await sandbox.runCode('Sys.getenv("TEST_ENV_VAR")', {
      language: 'r',
    })

    expect(result.results[0]?.text.trim()).toEqual('[1] "supertest"')
  } finally {
    await sandbox.kill()
  }
})

sandboxTest('env vars per execution (R)', async ({ sandbox }) => {
  const result = await sandbox.runCode('Sys.getenv("FOO")', {
    envs: { FOO: 'bar' },
    language: 'r',
  })

  const result_empty = await sandbox.runCode(
    'Sys.getenv("FOO", unset = "default")',
    {
      language: 'r',
    }
  )

  expect(result.results[0]?.text.trim()).toEqual('[1] "bar"')
  expect(result_empty.results[0]?.text.trim()).toEqual('[1] "default"')
})

sandboxTest.skipIf(isDebug)('env vars overwrite', async ({ template }) => {
  const sandbox = await Sandbox.create(template, {
    envs: { TEST_ENV_VAR: 'supertest' },
  })

  try {
    const result = await sandbox.runCode('Sys.getenv("TEST_ENV_VAR")', {
      language: 'r',
      envs: { TEST_ENV_VAR: 'overwrite' },
    })

    const result_global_default = await sandbox.runCode(
      'Sys.getenv("TEST_ENV_VAR")',
      {
        language: 'r',
      }
    )

    expect(result.results[0]?.text.trim()).toEqual('[1] "overwrite"')
    expect(result_global_default.results[0]?.text.trim()).toEqual(
      '[1] "supertest"'
    )
  } finally {
    await sandbox.kill()
  }
})
