import { Octokit } from '@octokit/rest'

export function getGHUserClient({ accessToken }: { accessToken: string }) {
  return new Octokit({
    auth: accessToken,
  })
}
