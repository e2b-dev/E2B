import { expect } from 'vitest'

import { sandboxTest } from '../../setup.js'

sandboxTest(
  'git createGitHubRepo requires token and name',
  async ({ sandbox }) => {
    await expect(
      sandbox.git.createGitHubRepo({ name: '' as string })
    ).rejects.toThrow(/GitHub token and repository name/)
  }
)
