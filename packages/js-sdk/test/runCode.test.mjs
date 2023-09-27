import { runCode } from '../src'
import { expect, test } from 'vitest'

// test('run code', async () => {
//   const code = `
// print("hello")
// raise Exception("err")
// `
//   const { stdout, stderr } = await runCode('Python3', code)
//   console.log('stdout', stdout)
//   console.log('stderr', stderr)

//   expect(stdout).toEqual('hello')
//   // expect(stderr).toContain('Exception: err')
// })

test('run code using unsupported runtime', async () => {
  await expect(await runCode('Unsupported', 'print("hello")')).rejects.toThrow(
    "runtime isn't supported",
  )
})
