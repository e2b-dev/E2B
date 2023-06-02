import type { HandlerFunction } from '@octokit/webhooks/dist-types/types'
import {
  Webhooks,
  createNodeMiddleware,
} from '@octokit/webhooks'

import { getDeploymentsForPR, getGHAccessToken, getPromptFromPR, triggerSmolDevAgentRun } from './pullRequest'
import { getGHInstallationClient } from './installationClient'

export async function getGitHubWebhooksMiddleware() {
  const webhooks = new Webhooks({
    secret: process.env.GITHUB_APP_WEBHOOK_SECRET!,
  })

  webhooks.on('issue_comment', issueCommentHandler)
  webhooks.on('pull_request.edited', pullRequestEditHandler)

  // TODO: Add handling for review comments
  return createNodeMiddleware(webhooks, {
    path: '/api/github/webhook', log: {
      debug: console.log,
      info: console.log,
      warn: console.log,
      error: console.error,
    }
  })
}

const pullRequestEditHandler: HandlerFunction<'pull_request.edited', unknown> = async (event) => {
  const { payload } = event

  const installationID = payload.installation?.id
  const repositoryID = payload.repository.id
  const owner = payload.repository.owner.login
  const repo = payload.repository.name

  // Every PR is also an issues - GH API endpoint for issues is used for the shared functionality
  const issueID = payload.pull_request.id
  const issueNumber = payload.pull_request.number
  const body = payload.pull_request.body || ''

  if (!installationID) {
    throw new Error('InstallationID not found')
  }

  const client = getGHInstallationClient({ installationID })

  const [prompt, deployments] = await Promise.all([
    getPromptFromPR({ client, issueNumber, repo, owner, body }),
    getDeploymentsForPR({ issueID, installationID, repositoryID }),
  ])

  if (deployments.length === 0) {
    console.log('No deployments found')
    return
  }

  const res = await Promise.allSettled(
    deployments.map(async deployment => {
      const accessToken = await getGHAccessToken({
        client,
        installationID,
        repositoryID,
      })
      await triggerSmolDevAgentRun({
        prompt,
        deployment,
        accessToken,
        commitMessage: 'Update based on PR comments',
        owner,
        repo,
        client,
        pullNumber: issueNumber,
      })
    }))

  console.log('Trigger results', res)
}

function getPRNumber(pr_url?: string) {
  const prNumber = pr_url?.split('/').pop()

  if (prNumber) {
    return parseInt(prNumber, 10)
  }
}

const issueCommentHandler: HandlerFunction<'issue_comment', unknown> = async (event) => {
  const { payload } = event

  if (payload.comment.user.type === 'Bot') {
    console.log('Comment was made by a GitHub bot, ignoring')
    return
  }

  const installationID = payload.installation?.id
  const repositoryID = payload.repository.id

  const owner = payload.repository.owner.login
  const repo = payload.repository.name

  // Every PR is also an issues - GH API endpoint for issues is used for the shared functionality
  // This issueID is not the PR issue id though, it's the issue id of the comment
  if (!installationID) {
    throw new Error('InstallationID not found')
  }

  const client = getGHInstallationClient({ installationID })
  const pullNumber = getPRNumber(payload.issue.pull_request?.url)
  if (!pullNumber) {
    throw new Error('PR number not found')
  }

  const pr = await client.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
  })

  const body = pr.data.body || ''

  const [prompt, deployments] = await Promise.all([
    getPromptFromPR({ client, issueNumber: pullNumber, repo, owner, body }),
    getDeploymentsForPR({ issueID: pr.data.id, installationID, repositoryID }),
  ])

  if (deployments.length === 0) {
    console.log('No deployments found')
    return
  }

  const res = await Promise.allSettled(
    deployments.map(async deployment => {
      const accessToken = await getGHAccessToken({
        client,
        installationID,
        repositoryID,
      })
      await triggerSmolDevAgentRun({
        prompt,
        deployment,
        accessToken,
        owner,
        repo,
        commitMessage: 'Update based on PR comments',
        client,
        pullNumber,
      })
    }))

  console.log('Trigger results', res)
}
