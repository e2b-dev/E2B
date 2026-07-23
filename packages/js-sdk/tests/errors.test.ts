import { expect, test } from 'vitest'
import { BuildError, SandboxError, TimeoutError } from '../src'

const userFrames = '    at buildTemplate (/home/user/template.ts:3:9)'

test('attached stack trace keeps the message header', () => {
  const error = new BuildError('build failed', userFrames)
  expect(error.stack).toBe(`BuildError: build failed\n${userFrames}`)
})

test('subclass name set after synthesis appears in the header', () => {
  const error = new TimeoutError('too slow', userFrames)
  expect(error.stack).toBe(`TimeoutError: too slow\n${userFrames}`)
})

test('natural throw site is preserved on cause', () => {
  const error = new SandboxError('boom', userFrames)
  expect(error.cause).toBeInstanceOf(Error)
  // The cause carries the stack captured where the error was constructed
  expect(typeof (error.cause as Error).stack).toBe('string')
})

test('cause is non-enumerable, matching native Error cause semantics', () => {
  const error = new SandboxError('boom', userFrames)
  expect(Object.keys(error)).not.toContain('cause')
  expect(JSON.stringify(error)).not.toContain('cause')
})

test('stack stays assignable after synthesis', () => {
  const error = new BuildError('boom', userFrames)
  error.stack = 'replaced'
  expect(error.stack).toBe('replaced')
})

test('errors without an attached stack trace are untouched', () => {
  const error = new BuildError('plain')
  expect(error.cause).toBeUndefined()
  expect(error.stack).toContain('plain')
})
