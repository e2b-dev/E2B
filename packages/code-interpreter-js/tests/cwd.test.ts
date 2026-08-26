import { expect } from 'vitest'

import { isDebug, sandboxTest } from './setup'

// Skip these tests in debug mode — the pwd and user in the testing docker container
// are not the same as in the actual sandbox.

sandboxTest.skipIf(isDebug)('cwd python', async ({ sandbox }) => {
  const result = await sandbox.runCode(
    'from pathlib import Path; print(Path.cwd())',
    { language: 'python' }
  )
  expect(result.logs.stdout.join().trim()).toEqual('/home/user')
})

sandboxTest.skipIf(isDebug)('cwd javascript', async ({ sandbox }) => {
  const result = await sandbox.runCode('process.cwd()', {
    language: 'js',
  })
  expect(result.text).toEqual('/home/user')
})

sandboxTest.skipIf(isDebug)('cwd typescript', async ({ sandbox }) => {
  const result = await sandbox.runCode('process.cwd()', {
    language: 'ts',
  })
  expect(result.text).toEqual('/home/user')
})

sandboxTest.skipIf(isDebug)('cwd r', async ({ sandbox }) => {
  const result = await sandbox.runCode('getwd()', {
    language: 'r',
  })
  expect(result.results[0]?.text.trim()).toEqual('[1] "/home/user"')
})

sandboxTest.skipIf(isDebug)('cwd java', async ({ sandbox }) => {
  const result = await sandbox.runCode('System.getProperty("user.dir")', {
    language: 'java',
  })
  expect(result.results[0]?.text.trim()).toEqual('/home/user')
})

sandboxTest.skipIf(isDebug)('cwd bash', async ({ sandbox }) => {
  const result = await sandbox.runCode('pwd', {
    language: 'bash',
  })
  expect(result.logs.stdout.join().trim()).toEqual('/home/user')
})
