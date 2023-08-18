import { Configuration, OpenAIApi } from 'openai'
import { backOff } from 'exponential-backoff'

import api from 'api-client/api'
import { deployments, prisma } from 'db/prisma'

import { GitHubClient } from './client'


export async function prTitleFromInstructions(instructions: string, openAIKey?: string) {
  const configuration = new Configuration({
    apiKey: openAIKey || process.env.OPENAI_API_KEY,
  })

  const openai = new OpenAIApi(configuration)

  try {
    const result = await backOff(() => openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          content: `${instructions}\n\nTl;dr in one sentence (around 50 characters) describing what to build. Don't use pronouns, just describe the thing:`,
          role: 'user',
        }
      ],
    }))
    return result.data.choices[0].message?.content
  } catch (error: any) {
    if (error.response) {
      console.log(error.response)
      throw new Error(error.response.data.error.message)
    } else {
      throw new Error(error.message)
    }
  }
}

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
      path: 'README.md',
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

  const prBody = issueResult?.data.body || body!
  const comments = commentsResult.data
    .filter(c => c.user?.type !== 'Bot')
    .map(c => c.body)
    .join('\n')


  // Remove everything from the prBody string after the last '---'
  // This is the separator between the PR description and the PR body
  const indexOfSeparator = prBody.lastIndexOf('---')
  const prBodyWithoutSeparator = prBody.substring(0, indexOfSeparator)
  return `${prBodyWithoutSeparator}\n\n${comments}`
}

export async function getDeploymentsForPR({
  installationID,
  issueID,
  repositoryID,
  enabled,
}: {
  enabled: boolean | undefined,
  repositoryID: number,
  issueID: number,
  installationID: number,
}) {
  return await prisma.deployments.findMany({
    include: {
      _count: {
        select: {
          log_files: true,
        },
      },
      projects: {
        include: {
          teams: {
            include: {
              users_teams: {
                include: {
                  users: true,
                },
              },
            },
          },
        },
      },
    },
    where: {
      enabled,
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

export const disableAgentDeployment = api
  .path('/deployments/{id}')
  .method('delete')
  .create()

export async function triggerSmolDevAgentRun({
  client,
  deployment,
  prompt,
  accessToken,
  commitMessage,
  slug,
  owner,
  repo,
  pullNumber,
  totalRuns,
}: {
  totalRuns: number,
  slug: string | null,
  pullNumber: number,
  client: GitHubClient,
  owner: string,
  repo: string,
  commitMessage: string,
  deployment: deployments,
  prompt: string,
  accessToken: string,
}) {
  if (!slug) throw new Error('slug is required')

  console.log('Triggering smol dev agent run:', { owner, repo, pullNumber, prompt })
  await addCommentToPR({
    body: `Started smol developer [agent run](https://app.e2b.dev/logs/${slug}-run-${totalRuns}?utm_source=github).`,
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
