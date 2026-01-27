import { expect } from 'vitest'

import { shellEscape } from '../../../src/sandbox/git/utils'
import { isDebug, sandboxTest } from '../../setup.js'

const authTestEnabled = process.env.E2B_DEBUG_GIT_AUTH !== undefined
const shouldSkip = !isDebug || !authTestEnabled
const debugGitTest = sandboxTest.skipIf(shouldSkip)

const host = 'example.com'
const protocol = 'https'
const username = 'git'
const password = 'token'
const expectedCredential = `${protocol}://${username}:${password}@${host}`
const configuredName = 'E2B Debug'
const configuredEmail = 'debug@e2b.dev'

debugGitTest(
  'dangerouslyAuthenticate configures global credentials and user (debug-only)',
  async ({ sandbox }) => {
    const home = (await sandbox.commands.run('echo $HOME')).stdout.trim()
    const credentialsPath = `${home}/.git-credentials`
    const credentialsBackupPath = `${credentialsPath}.__bak__`

    const originalHelper = (
      await sandbox.commands.run(
        'git config --global --get credential.helper || true'
      )
    ).stdout.trim()
    const originalName = (
      await sandbox.commands.run('git config --global --get user.name || true')
    ).stdout.trim()
    const originalEmail = (
      await sandbox.commands.run('git config --global --get user.email || true')
    ).stdout.trim()

    await sandbox.commands.run(
      `if [ -f "${credentialsPath}" ]; then cp "${credentialsPath}" "${credentialsBackupPath}"; else rm -f "${credentialsBackupPath}"; fi`
    )

    try {
      await sandbox.git.dangerouslyAuthenticate({
        username,
        password,
        host,
        protocol,
      })
      await sandbox.git.configureUser(configuredName, configuredEmail)

      const helperAfter = (
        await sandbox.commands.run(
          'git config --global --get credential.helper || true'
        )
      ).stdout.trim()
      expect(helperAfter).toBe('store')

      const credentialCheck = (
        await sandbox.commands.run(
          `if [ -f "${credentialsPath}" ] && grep -F ${shellEscape(expectedCredential)} "${credentialsPath}" >/dev/null; then echo found; else echo missing; fi`
        )
      ).stdout.trim()
      expect(credentialCheck).toBe('found')

      const nameAfter = (
        await sandbox.commands.run(
          'git config --global --get user.name || true'
        )
      ).stdout.trim()
      const emailAfter = (
        await sandbox.commands.run(
          'git config --global --get user.email || true'
        )
      ).stdout.trim()
      expect(nameAfter).toBe(configuredName)
      expect(emailAfter).toBe(configuredEmail)
    } finally {
      const restoreHelperCmd = originalHelper
        ? `git config --global credential.helper ${shellEscape(originalHelper)}`
        : 'git config --global --unset credential.helper || true'
      const restoreNameCmd = originalName
        ? `git config --global user.name ${shellEscape(originalName)}`
        : 'git config --global --unset user.name || true'
      const restoreEmailCmd = originalEmail
        ? `git config --global user.email ${shellEscape(originalEmail)}`
        : 'git config --global --unset user.email || true'

      await sandbox.commands.run(restoreHelperCmd)
      await sandbox.commands.run(restoreNameCmd)
      await sandbox.commands.run(restoreEmailCmd)
      await sandbox.commands.run(
        `if [ -f "${credentialsBackupPath}" ]; then mv "${credentialsBackupPath}" "${credentialsPath}"; else rm -f "${credentialsPath}"; fi`
      )
    }
  }
)
