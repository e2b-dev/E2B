import { Octokit } from '@octokit/rest'

function getUserClient({ accessToken }: { accessToken: string }) {
  return new Octokit({
    auth: accessToken,
  })
}

export type GitHubUserClient = ReturnType<typeof getUserClient>

export default getUserClient
