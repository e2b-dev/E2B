import { expect, test } from 'vitest'

import { sha256 } from '../src/utils'

test('sha256 hashes with WebCrypto', async () => {
  expect(await sha256('hello')).toBe(
    'LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ='
  )
})
