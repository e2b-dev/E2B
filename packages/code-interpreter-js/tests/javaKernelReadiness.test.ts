import { expect, test, vi } from 'vitest'

import { Sandbox, SandboxError } from '../src'
import { waitForKernel } from './setup'

const javaNotReadyError = () => new SandboxError('500 Internal Server Error')
const tracedNotReadyError = () =>
  new SandboxError('500 Internal Server Error (trace_id=trace-123)')

function mockSandbox(runCode: ReturnType<typeof vi.fn>) {
  return { runCode } as unknown as Sandbox
}

test.each(['java', 'r'] as const)(
  'retries one %s readiness 500',
  async (language) => {
    const runCode = vi
      .fn()
      .mockRejectedValueOnce(javaNotReadyError())
      .mockResolvedValueOnce(undefined)

    await waitForKernel(mockSandbox(runCode), language)

    expect(runCode).toHaveBeenCalledTimes(2)
    expect(runCode).toHaveBeenNthCalledWith(1, '1', { language })
    expect(runCode).toHaveBeenNthCalledWith(2, '1', { language })
  }
)

test('propagates a persistent Java readiness 500', async () => {
  const secondError = javaNotReadyError()
  const runCode = vi
    .fn()
    .mockRejectedValueOnce(javaNotReadyError())
    .mockRejectedValueOnce(secondError)

  await expect(waitForKernel(mockSandbox(runCode), 'java')).rejects.toBe(
    secondError
  )
  expect(runCode).toHaveBeenCalledTimes(2)
})

test('does not retry an unrelated Java error', async () => {
  const error = new SandboxError('401 Unauthorized')
  const runCode = vi.fn().mockRejectedValueOnce(error)

  await expect(waitForKernel(mockSandbox(runCode), 'java')).rejects.toBe(error)
  expect(runCode).toHaveBeenCalledTimes(1)
})

test('retries an empty readiness 500 that includes a trace ID', async () => {
  const runCode = vi
    .fn()
    .mockRejectedValueOnce(tracedNotReadyError())
    .mockResolvedValueOnce(undefined)

  await waitForKernel(mockSandbox(runCode), 'r')

  expect(runCode).toHaveBeenCalledTimes(2)
})
