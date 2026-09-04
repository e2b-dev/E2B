import { expect } from 'vitest'

import { sandboxTest } from './setup'

sandboxTest('callback results', async ({ sandbox }) => {
  const results = []
  const result = await sandbox.runCode('x =1; x', {
    onResult: (result) => results.push(result),
  })

  expect(results.length).toBe(1)
  expect(result.results[0].text).toBe('1')
})

sandboxTest('callback error', async ({ sandbox }) => {
  const errors = []
  const result = await sandbox.runCode('xyz', {
    onError: (error) => errors.push(error),
  })

  expect(errors.length).toBe(1)
  expect(result.error.name).toBe('NameError')
})

sandboxTest('callback stdout', async ({ sandbox }) => {
  const stdout = []
  const result = await sandbox.runCode('print("hello")', {
    onStdout: (out) => stdout.push(out),
  })

  expect(stdout.length).toBe(1)
  expect(result.logs.stdout).toEqual(['hello\n'])
})

sandboxTest('callback stderr', async ({ sandbox }) => {
  const stderr = []
  const result = await sandbox.runCode(
    'import sys;print("This is an error message", file=sys.stderr)',
    {
      onStderr: (err) => stderr.push(err),
    }
  )

  expect(stderr.length).toBe(1)
  expect(result.logs.stderr).toEqual(['This is an error message\n'])
})
