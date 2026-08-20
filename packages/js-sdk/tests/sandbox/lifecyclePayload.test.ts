import { expect, test } from 'vitest'

import { InvalidArgumentError, Sandbox } from '../../src'
import { TEST_API_KEY, template } from '../setup'

test('filesystem-only auto-pause cannot be combined with auto-resume', async () => {
  // A filesystem-only auto-pause snapshot can only be resumed explicitly, so
  // keepMemory:false with autoResume is rejected client-side.
  await expect(
    Sandbox.create(template, {
      apiKey: TEST_API_KEY,
      lifecycle: {
        onTimeout: { action: 'pause', keepMemory: false },
        autoResume: true,
      },
    })
  ).rejects.toThrowError(InvalidArgumentError)
})

test('keepMemory is not allowed when onTimeout action is kill', async () => {
  // The discriminated union forbids keepMemory on `action: 'kill'` at compile
  // time (asserted by @ts-expect-error). The runtime guard below additionally
  // rejects it for untyped (JS) callers that bypass the type.
  await expect(
    Sandbox.create(template, {
      apiKey: TEST_API_KEY,
      lifecycle: {
        // @ts-expect-error keepMemory is not allowed with action: 'kill'
        onTimeout: { action: 'kill', keepMemory: false },
      },
    })
  ).rejects.toThrowError(InvalidArgumentError)
})
