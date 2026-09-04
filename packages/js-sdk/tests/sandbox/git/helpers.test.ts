import { describe, expect, test, vi } from 'vitest'

import { cleanupBaseDir } from './helpers.js'

describe('cleanupBaseDir', () => {
  test('retries a Cloudflare dropped connection once', async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error('2: [unknown] Network connection lost.'))
      .mockResolvedValueOnce(undefined)

    await cleanupBaseDir({ commands: { run } }, '/tmp/test-git/example')

    expect(run).toHaveBeenCalledTimes(2)
    expect(run).toHaveBeenNthCalledWith(1, 'rm -rf "/tmp/test-git/example"')
    expect(run).toHaveBeenNthCalledWith(2, 'rm -rf "/tmp/test-git/example"')
  })

  test('does not retry other cleanup failures', async () => {
    const error = new Error('permission denied')
    const run = vi.fn().mockRejectedValue(error)

    await expect(
      cleanupBaseDir({ commands: { run } }, '/tmp/test-git/example')
    ).rejects.toBe(error)

    expect(run).toHaveBeenCalledTimes(1)
  })

  test('propagates the second dropped connection after one retry', async () => {
    const firstError = new Error('2: [unknown] Network connection lost.')
    const secondError = new Error('2: [unknown] Network connection lost again.')
    const run = vi
      .fn()
      .mockRejectedValueOnce(firstError)
      .mockRejectedValueOnce(secondError)

    await expect(
      cleanupBaseDir({ commands: { run } }, '/tmp/test-git/example')
    ).rejects.toBe(secondError)

    expect(run).toHaveBeenCalledTimes(2)
  })
})
