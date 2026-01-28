import { expect } from 'vitest'

import { sandboxTest } from '../../setup.js'
import { AUTHOR_EMAIL, AUTHOR_NAME } from './helpers.js'

sandboxTest('git configureUser', async ({ sandbox }) => {
  await sandbox.git.configureUser(AUTHOR_NAME, AUTHOR_EMAIL)

  const name = (await sandbox.commands.run('git config --global --get user.name'))
    .stdout.trim()
  const email = (
    await sandbox.commands.run('git config --global --get user.email')
  ).stdout.trim()

  expect(name).toBe(AUTHOR_NAME)
  expect(email).toBe(AUTHOR_EMAIL)
})
