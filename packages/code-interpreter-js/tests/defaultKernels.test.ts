import { expect } from 'vitest'

import { sandboxTest } from './setup'

sandboxTest('test js kernel', async ({ sandbox }) => {
  const output = await sandbox.runCode('console.log("Hello World!")', {
    language: 'js',
  })
  expect(output.logs.stdout).toEqual(['Hello World!\n'])
})

sandboxTest('test esm imports', async ({ sandbox }) => {
  const output = await sandbox.runCode(
    `
    import { readFileSync } from 'fs'
    console.log(typeof readFileSync)
    `,
    {
      language: 'js',
    }
  )
  expect(output.logs.stdout).toEqual(['function\n'])
})

sandboxTest(
  'test top-level await and promise resolution',
  async ({ sandbox }) => {
    const output = await sandbox.runCode(
      `
    await Promise.resolve('Hello World!')
    `,
      {
        language: 'js',
      }
    )
    expect(output.text).toEqual('Hello World!')
  }
)

sandboxTest('test ts kernel', async ({ sandbox }) => {
  const output = await sandbox.runCode(
    'const message: string = "Hello World!"; console.log(message)',
    { language: 'ts' }
  )
  expect(output.logs.stdout).toEqual(['Hello World!\n'])
})
