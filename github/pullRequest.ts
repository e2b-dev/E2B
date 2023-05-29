import api from 'api-client/api'
import { deployments, prisma } from 'db/prisma'

import { GitHubClient } from './client'

// All PRs are also issues - GH API endpoint for issues is used for the shared functionality
export async function createPR({
  client,
  title,
  body,
  owner,
  repo,
  defaultBranch,
  branch,
  commitMessage,
}: {
  commitMessage: string,
  defaultBranch: string,
  client: GitHubClient,
  title: string,
  body: string,
  owner: string,
  repo: string,
  branch: string,
}): Promise<{ issueID: number }> {
  let baseBranchRefSHA: string | undefined

  try {
    const baseBranchRef = await client.git.getRef({
      owner,
      repo,
      ref: `refs/heads/${defaultBranch}`,
    })
    baseBranchRefSHA = baseBranchRef.data.object.sha
  } catch (error: any) {
    // Make sure we are not overwriting an existing branch
    // and only create a new branch and init repo if the repo is empty
    if (error.message !== 'Git Repository is empty.') throw error
    console.log('Repository is empty - creating initial empty commit')

    // TODO: Create empty commit without placeholder file by deleting the file,
    // creating an empty commit and then updating the default branch to point to the empty commit
    // This behavious is not clearly documented and it seems that sometimes the empty commit can get automatically pruned before the ref can be updated

    // Create placeholder file to create the default branch
    console.log('Creating placeholder file')
    const file = await client.repos.createOrUpdateFileContents({
      owner,
      repo,
      branch: defaultBranch,
      path: '/README.md',
      message: 'Initial commit',
      content: Buffer.from(`# ${repo}`, 'utf8').toString('base64'),
    })
    console.log('Finished creating placeholder file')

    baseBranchRefSHA = file.data.commit.sha
  }

  const newBranchRef = await client.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branch}`,
    sha: baseBranchRefSHA!,
  })

  const currentCommit = await client.git.getCommit({
    owner,
    repo,
    commit_sha: newBranchRef.data.object.sha,
  })

  const newCommit = await client.git.createCommit({
    owner,
    repo,
    message: commitMessage,
    tree: currentCommit.data.tree.sha,
    parents: [currentCommit.data.sha],
  })

  await client.git.updateRef({
    owner,
    repo,
    ref: `refs/heads/${branch}`,
    sha: newCommit.data.sha,
  })

  const pr = await client.pulls.create({
    owner,
    repo,
    head: branch,
    base: defaultBranch,
    title,
    body,
  })

  return {
    issueID: pr.data.id,
  }
}

export async function getPromptFromPR({
  issueID,
  client,
  repo,
  owner,
}: {
  owner: string,
  repo: string,
  client: GitHubClient,
  issueID: number,
}): Promise<string> {

  const [
    issueResult,
    commentsResult,
  ] = await Promise.all([
    client.issues.get({
      issue_number: issueID,
      owner,
      repo,
    }),
    client.issues.listComments({
      issue_number: issueID,
      owner,
      repo,
      per_page: 100,
    }),
  ])

  // TODO: Check if issue body and comments are returned as markdown
  const body = issueResult.data.body_text
  const comments = commentsResult.data
    .filter(c => !c.performed_via_github_app)
    .map(c => c.body_text)
    .join('\n')

  return `${body}\n\n${comments}`
}

export async function getDeploymentsForPR({
  installationID,
  issueID,
  repositoryID,
}: {
  repositoryID: number,
  issueID: number,
  installationID: number,
}) {
  return await prisma.deployments.findMany({
    where: {
      AND: [
        {
          auth: {
            path: ['github', 'repository_id'],
            equals: repositoryID,
          },
        },
        {
          auth: {
            path: ['github', 'issue_id'],
            equals: issueID,
          },
        },
        {
          auth: {
            path: ['github', 'installation_id'],
            equals: installationID,
          },
        },
      ],
    },
  })
}

export const interactWithAgent = api
  .path('/deployments/{id}/interactions')
  .method('post')
  .create()

export const createAgentDeployment = api
  .path('/deployments')
  .method('put')
  .create({
    project_id: true,
  })

export async function triggerSmolDevAgentRun({
  deployment,
  prompt,
  accessToken,
  commitMessage,
}: {
  commitMessage: string,
  deployment: deployments,
  prompt: string,
  accessToken: string,
}) {
  await interactWithAgent({
    id: deployment.id,
    type: 'start',
    data: {
      instructions: {
        // This provisioned access token has default expiry of 1 hour
        AccessToken: accessToken,
        CommitMessage: commitMessage,
        Prompt: prompt,
        GitHubAppName: (deployment?.auth as any)?.['github']?.['app_name'],
        GitHubAppEmail: (deployment?.auth as any)?.['github']?.['app_email'],
        Owner: (deployment?.auth as any)?.['github']?.['owner'],
        Repo: (deployment?.auth as any)?.['github']?.['repo'],
        Branch: (deployment?.auth as any)?.['github']?.['branch'],
      },
    } as any,
  })
}

export async function getGHAccessToken({
  client,
  installationID,
  repositoryID,
}: {
  client: GitHubClient,
  installationID: number,
  repositoryID: number,
}) {
  const result = await client.apps.createInstallationAccessToken({
    installation_id: installationID,
    repository_ids: [repositoryID],
    permissions: {
      contents: 'write',
    },
  })

  return result.data.token
}

export async function getGHAppInfo({
  client,
}: {
  client: GitHubClient,
}) {
  const result = await client.apps.getAuthenticated()
  const id = result.data.id
  const name = result.data.name

  return {
    name,
    email: `${id}+${name}[bot]@users.noreply.github.com`
  }
}
