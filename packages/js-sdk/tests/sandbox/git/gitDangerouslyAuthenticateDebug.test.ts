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
const configRepoPath = '/tmp/e2b-git-config-repo'

debugGitTest(
  'dangerouslyAuthenticate configures global credentials and user (debug-only)',
  async ({ sandbox }) => {
    const home = (await sandbox.commands.run('echo $HOME')).stdout.trim()
    const credentialsPath = `${home}/.git-credentials`
    const credentialsBackupPath = `${credentialsPath}.__bak__`

    const originalHelper = await sandbox.git.configGet('credential.helper', {
      scope: 'global',
    })
    const originalName = await sandbox.git.configGet('user.name', {
      scope: 'global',
    })
    const originalEmail = await sandbox.git.configGet('user.email', {
      scope: 'global',
    })

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

      const helperAfter = await sandbox.git.configGet('credential.helper', {
        scope: 'global',
      })
      expect(helperAfter).toBe('store')

      const credentialCheck = (
        await sandbox.commands.run(
          `if [ -f "${credentialsPath}" ] && grep -F ${shellEscape(expectedCredential)} "${credentialsPath}" >/dev/null; then echo found; else echo missing; fi`
        )
      ).stdout.trim()
      expect(credentialCheck).toBe('found')

      const nameAfter = await sandbox.git.configGet('user.name', {
        scope: 'global',
      })
      const emailAfter = await sandbox.git.configGet('user.email', {
        scope: 'global',
      })
      expect(nameAfter).toBe(configuredName)
      expect(emailAfter).toBe(configuredEmail)

      await sandbox.commands.run(
        [
          `rm -rf "${configRepoPath}"`,
          `mkdir -p "${configRepoPath}"`,
          `git -C "${configRepoPath}" init`,
        ].join(' && ')
      )
      await sandbox.git.configSet('pull.rebase', 'true', {
        scope: 'local',
        path: configRepoPath,
      })
      const localPullRebase = await sandbox.git.configGet('pull.rebase', {
        scope: 'local',
        path: configRepoPath,
      })
      expect(localPullRebase).toBe('true')
    } finally {
      if (originalHelper) {
        await sandbox.git.configSet('credential.helper', originalHelper, {
          scope: 'global',
        })
      } else {
        await sandbox.commands.run(
          'git config --global --unset credential.helper || true'
        )
      }
      if (originalName) {
        await sandbox.git.configSet('user.name', originalName, {
          scope: 'global',
        })
      } else {
        await sandbox.commands.run(
          'git config --global --unset user.name || true'
        )
      }
      if (originalEmail) {
        await sandbox.git.configSet('user.email', originalEmail, {
          scope: 'global',
        })
      } else {
        await sandbox.commands.run(
          'git config --global --unset user.email || true'
        )
      }
      await sandbox.commands.run(
        `if [ -f "${credentialsBackupPath}" ]; then mv "${credentialsBackupPath}" "${credentialsPath}"; else rm -f "${credentialsPath}"; fi`
      )
    }
  }
)
