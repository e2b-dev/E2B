import { Octokit } from '@octokit/rest'
import { createAppAuth } from '@octokit/auth-app'

export function getGHInstallationClient({ installationID: installationId }: { installationID: number }) {
  const appId = process.env.GITHUB_APP_ID
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      privateKey,
      appId,
      installationId,
    },
  })
}
