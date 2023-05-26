import getInstallationClient from './installationClient'

export async function createPR({ installationID, repositoryID, title, body, owner, repo }: {
  installationID: number,
  repositoryID: number,
  title: string,
  body: string,
  owner: string,
  repo: string,
}) {
  const client = getInstallationClient({ installationID })

  // TODO: Get default branch

  // TODO: Create branch from default branch

  // TODO: Do we need to create an empty commit for the PR?

  client.pulls.create({
    owner,
    repo,
    title,
    body,
    head: 'smol-dev:new-feature',
    base: 'master',
  })
}
