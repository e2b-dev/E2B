import { expect } from 'vitest'

import { sandboxTest } from './setup'

sandboxTest('env vars per execution', async ({ sandbox }) => {
  const result = await sandbox.runCode('import os; os.getenv("FOO")', {
    envs: { FOO: 'bar' },
  })
  const resultEmpty = await sandbox.runCode(
    "import os; os.getenv('FOO', 'default')"
  )

  expect(result.results[0]?.text.trim()).toEqual('bar')
  expect(resultEmpty.results[0]?.text.trim()).toEqual('default')
})
