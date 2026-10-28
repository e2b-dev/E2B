import { expect, test, vi } from 'vitest'

import { Sandbox, TimeoutError } from '../src'

function desktop() {
  const sandbox = Object.create(Sandbox.prototype) as Sandbox
  const run = vi.fn().mockResolvedValue(undefined)
  const read = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]))
  const remove = vi.fn().mockResolvedValue(undefined)
  Object.defineProperties(sandbox, {
    commands: { value: { run } },
    files: { value: { read, remove } },
  })
  return { sandbox, run, read, remove }
}

test.each(['bytes', 'blob', 'stream'] as const)(
  'waits for cleanup before returning a %s screenshot',
  async (format) => {
    const { sandbox, run, read, remove } = desktop()
    const bytes = new Uint8Array([1, 2, 3])
    const file =
      format === 'bytes'
        ? bytes
        : format === 'blob'
          ? new Blob([bytes])
          : new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(bytes)
                controller.close()
              },
            })
    read.mockResolvedValue(file)
    let finishCleanup!: () => void
    remove.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finishCleanup = resolve
        })
    )
    const settled = vi.fn()

    // @ts-expect-error The overloads accept each format, but not their union.
    const screenshot = sandbox.screenshot(format)
    const result = screenshot.then((image) => {
      settled()
      return image
    })
    await vi.waitFor(() => expect(remove).toHaveBeenCalledOnce())
    try {
      expect(settled).not.toHaveBeenCalled()
    } finally {
      finishCleanup()
    }
    expect(await result).toBe(file)
    const path = read.mock.calls[0][0]
    expect(run).toHaveBeenCalledWith(`scrot --pointer ${path}`)
    expect(read).toHaveBeenCalledWith(path, { format })
    expect(remove).toHaveBeenCalledWith(path)
    if (file instanceof ReadableStream) {
      expect(await new Response(file).bytes()).toEqual(bytes)
    }
  }
)

test('returns the screenshot when awaited cleanup fails', async () => {
  const { sandbox, read, remove } = desktop()
  const file = new Uint8Array([1, 2, 3])
  read.mockResolvedValue(file)
  remove.mockRejectedValue(new TimeoutError('sandbox is gone'))

  await expect(sandbox.screenshot()).resolves.toBe(file)
  expect(remove).toHaveBeenCalledOnce()
})

test.each(['capture', 'read'] as const)(
  'cleans up after a %s failure and preserves the original error',
  async (stage) => {
    const { sandbox, run, read, remove } = desktop()
    const failure = new Error(`${stage} failed`)
    ;(stage === 'capture' ? run : read).mockRejectedValue(failure)
    remove.mockRejectedValue(new TimeoutError('cleanup failed'))

    await expect(sandbox.screenshot()).rejects.toBe(failure)

    expect(remove).toHaveBeenCalledOnce()
    expect(remove).toHaveBeenCalledWith(
      expect.stringMatching(/^\/tmp\/screenshot-.+\.png$/)
    )
    if (stage === 'capture') expect(read).not.toHaveBeenCalled()
  }
)
