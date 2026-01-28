import { expect } from 'vitest'

import { sandboxTest } from '../../setup.js'
import { HOST, PASSWORD, PROTOCOL, USERNAME } from './helpers.js'

sandboxTest('git dangerouslyAuthenticate sets helper', async ({ sandbox }) => {
  await sandbox.git.dangerouslyAuthenticate({
    username: USERNAME,
    password: PASSWORD,
    host: HOST,
    protocol: PROTOCOL,
  })

  const helper = (
    await sandbox.commands.run('git config --global --get credential.helper')
  ).stdout.trim()
  expect(helper).toBe('store')
})
