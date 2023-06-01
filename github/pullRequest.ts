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
}) {
  let baseBranchRefSHA: string | undefined

  try {
    const baseBranchRef = await client.git.getRef({
      owner,
      repo,
      ref: `heads/${defaultBranch}`,
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
    ref: `heads/${branch}`,
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
    number: pr.data.number,
    url: pr.data.html_url,
  }
}

export async function getPromptFromPR({
  issueNumber,
  client,
  repo,
  owner,
  body,
}: {
  body?: string,
  owner: string,
  repo: string,
  client: GitHubClient,
  // Number identifying the issue in the repo (this is not issueID)
  issueNumber: number,
}): Promise<string> {

  const [
    issueResult,
    commentsResult,
  ] = await Promise.all([
    body === undefined ? client.issues.get({
      issue_number: issueNumber,
      owner,
      repo,
    }) : Promise.resolve(undefined),
    client.issues.listComments({
      issue_number: issueNumber,
      owner,
      repo,
      // TODO: Handle pagination
      page: 1,
      per_page: 100,
    }),
  ])

  const prBody = issueResult?.data.body || body
  const comments = commentsResult.data
    .filter(c => c.user?.type !== 'Bot')
    .map(c => c.body)
    .join('\n')

  return `${prBody}\n\n${comments}`
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
      enabled: true,
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
  client,
  deployment,
  prompt,
  accessToken,
  commitMessage,
  owner,
  repo,
  pullNumber,
}: {
  pullNumber: number,
  client: GitHubClient,
  owner: string,
  repo: string,
  commitMessage: string,
  deployment: deployments,
  prompt: string,
  accessToken: string,
}) {
  console.log('Triggering smol dev agent run:', { owner, repo, pullNumber, prompt })

  await addCommentToPR({
    body: 'Started smol dev agent run',
    client,
    owner,
    repo,
    pullNumber,
  })

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
        Owner: owner,
        Repo: repo,
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
  const name = `${result.data.slug}[bot]`

  return {
    name,
    email: `${id}+${name}@users.noreply.github.com`
  }
}

export async function addCommentToPR({
  pullNumber,
  repo,
  owner,
  client,
  body,
}: {
  pullNumber: number,
  repo: string,
  owner: string,
  client: GitHubClient,
  body: string,
}) {
  await client.issues.createComment({
    owner,
    repo,
    issue_number: pullNumber,
    body,
  })
}
