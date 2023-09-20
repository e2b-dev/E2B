import path from 'path'
import { expect, test } from 'vitest'

import * as e2bFs from '../src/utils/filesystem'

test('getFiles(): empty-dir', async () => {
  const files = await e2bFs.getFiles(
    path.join(process.cwd(), 'test/fixtures/empty-dir'),
    { respectGitignore: true, respectDockerignore: true },
  )
  expect(files).toEqual([])
})
