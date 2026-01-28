import { expect } from 'vitest'

import { sandboxTest } from '../../setup.js'
import { AUTHOR_EMAIL, AUTHOR_NAME } from './helpers.js'

sandboxTest('git configureUser', async ({ sandbox }) => {
  await sandbox.git.configureUser(AUTHOR_NAME, AUTHOR_EMAIL)

  const name = (
    await sandbox.commands.run('git config --global --get user.name')
  ).stdout.trim()
  const email = (
    await sandbox.commands.run('git config --global --get user.email')
  ).stdout.trim()
  const configuredName = await sandbox.git.getConfig('user.name', {
    scope: 'global',
  })
  const configuredEmail = await sandbox.git.getConfig('user.email', {
    scope: 'global',
  })

  expect(name).toBe(AUTHOR_NAME)
  expect(email).toBe(AUTHOR_EMAIL)
  expect(configuredName).toBe(AUTHOR_NAME)
  expect(configuredEmail).toBe(AUTHOR_EMAIL)
})
