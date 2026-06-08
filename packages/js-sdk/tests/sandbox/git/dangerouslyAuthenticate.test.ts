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
  const configuredHelper = await sandbox.git.getConfig('credential.helper', {
    scope: 'global',
  })
  expect(helper).toBe('store')
  expect(configuredHelper).toBe('store')

  const credentials = (
    await sandbox.commands.run('cat "$HOME/.git-credentials"')
  ).stdout.trim()
  expect(credentials).toContain(`${PROTOCOL}://${USERNAME}:${PASSWORD}@${HOST}`)

  const filled = (
    await sandbox.commands.run(`printf '%s' 'protocol=${PROTOCOL}
host=${HOST}

' | git credential fill`)
  ).stdout
  expect(filled).toContain(`username=${USERNAME}`)
  expect(filled).toContain(`password=${PASSWORD}`)
})
