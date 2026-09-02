import { expect, test, vi } from 'vitest'

import { Sandbox, SandboxError } from '../src'
import { waitForJavaKernel } from './setup'

const javaNotReadyError = () => new SandboxError('500 Internal Server Error')

function mockSandbox(runCode: ReturnType<typeof vi.fn>) {
  return { runCode } as unknown as Sandbox
}

test('retries one Java readiness 500', async () => {
  const runCode = vi
    .fn()
    .mockRejectedValueOnce(javaNotReadyError())
    .mockResolvedValueOnce(undefined)

  await waitForJavaKernel(mockSandbox(runCode))

  expect(runCode).toHaveBeenCalledTimes(2)
  expect(runCode).toHaveBeenNthCalledWith(1, '1', { language: 'java' })
  expect(runCode).toHaveBeenNthCalledWith(2, '1', { language: 'java' })
})

test('propagates a persistent Java readiness 500', async () => {
  const secondError = javaNotReadyError()
  const runCode = vi
    .fn()
    .mockRejectedValueOnce(javaNotReadyError())
    .mockRejectedValueOnce(secondError)

  await expect(waitForJavaKernel(mockSandbox(runCode))).rejects.toBe(
    secondError
  )
  expect(runCode).toHaveBeenCalledTimes(2)
})

test('does not retry an unrelated Java error', async () => {
  const error = new SandboxError('401 Unauthorized')
  const runCode = vi.fn().mockRejectedValueOnce(error)

  await expect(waitForJavaKernel(mockSandbox(runCode))).rejects.toBe(error)
  expect(runCode).toHaveBeenCalledTimes(1)
})
