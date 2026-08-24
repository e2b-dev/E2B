import { expect, test } from 'vitest'

import { InvalidArgumentError } from '../../src/errors'
import { Sandbox } from '../../src'
import { TEST_API_KEY } from '../setup'

test('fork with count lower than 1 fails', async () => {
  await expect(
    Sandbox.fork('sbx-test', { count: 0, apiKey: TEST_API_KEY })
  ).rejects.toThrowError(InvalidArgumentError)
})
