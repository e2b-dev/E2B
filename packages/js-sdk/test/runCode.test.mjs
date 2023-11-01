import { runCode } from '../src'
import { expect, test } from 'vitest'

test('run code', async () => {
  const code = `
test="test\\n"
print(10*test)
raise Exception("err")
`
  const { stdout, stderr } = await runCode('Python3', code)
  console.log('stdout', stdout)
  console.log('stderr', stderr)
  expect(stdout.length).toEqual(50)
  expect(stderr).toContain('Exception: err')
}, 10000)

test('run code using unsupported runtime', async () => {
  await expect(() => runCode('Unsupported', 'print("hello")')).rejects.toThrowError(
    'isn\'t supported'
  )
})
