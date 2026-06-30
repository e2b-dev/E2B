import { assert, test, describe, vi, afterEach } from 'vitest'
import { handleBuildError } from '../../src/template/logger'
import { AuthenticationError, BuildError, SandboxError } from '../../src/errors'

describe('handleBuildError', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function run(err: unknown) {
    const exit = vi
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never)
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    handleBuildError(err)
    return { exit, error }
  }

  test('prints a single clean message for known errors and exits 1', () => {
    const { exit, error } = run(new AuthenticationError('API key is required'))
    assert.equal(exit.mock.calls[0][0], 1)
    assert.lengthOf(error.mock.calls, 1)
    assert.match(error.mock.calls[0][0], /Build failed: API key is required/)
  })

  test('handles SandboxError subclasses', () => {
    const { error } = run(new SandboxError('boom'))
    assert.match(error.mock.calls[0][0], /Build failed: boom/)
  })

  test('handles BuildError (build failures do not extend SandboxError)', () => {
    const { exit, error } = run(new BuildError('build failed'))
    assert.equal(exit.mock.calls[0][0], 1)
    assert.match(error.mock.calls[0][0], /Build failed: build failed/)
  })

  test('keeps the full error for unexpected errors', () => {
    const unexpected = new TypeError('unexpected')
    const { exit, error } = run(unexpected)
    assert.equal(exit.mock.calls[0][0], 1)
    assert.equal(error.mock.calls[0][0], unexpected)
  })
})
