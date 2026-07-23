import { expect, test } from 'vitest'

import { getUndiciPackageCandidates } from '../src/undici'

test.each([
  ['20.20.2', ['undici']],
  ['22.18.0', ['undici']],
  ['22.19.0', ['undici8', 'undici']],
  ['24.0.0', ['undici8', 'undici']],
])('selects the packages supported by Node %s', (version, expected) => {
  expect(getUndiciPackageCandidates(version as string)).toEqual(expected)
})
