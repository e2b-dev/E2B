import type { HandlerFunction } from '@octokit/webhooks/dist-types/types'
import {
  Webhooks,
  createNodeMiddleware,
} from '@octokit/webhooks'

import { getDeploymentsForPR, getGHAccessToken, getPromptFromPR, triggerSmolDevAgentRun } from './pullRequest'
import { getGHInstallationClient } from './installationClient'
import { parseRepoName } from './repo'

export async function getGitHubWebhooksMiddleware() {
  const webhooks = new Webhooks({
    secret: process.env.GITHUB_APP_WEBHOOK_SECRET!,
  })

  webhooks.on('issue_comment', issueCommentHandler)
  webhooks.on('pull_request.edited', pullRequestEditHandler)

  // TODO: Add handling for review comments
  return createNodeMiddleware(webhooks, { path: '/api/github/webhook' })
}

const pullRequestEditHandler: HandlerFunction<'pull_request.edited', unknown> = async (event) => {
  const { payload } = event

  const installationID = payload.installation?.id
  const repositoryID = payload.repository.id
  const { owner, repo } = parseRepoName(payload.repository.full_name)

  // Every PR is also an issues - GH API endpoint for issues is used for the shared functionality
  const issueID = payload.pull_request.id
  const prompt = payload.pull_request.body as string

  if (!installationID) {
    throw new Error('InstallationID not found')
  }

  const client = getGHInstallationClient({ installationID })

  const [deployments] = await Promise.all([
    getDeploymentsForPR({ issueID, installationID, repositoryID }),
  ])

  await Promise.allSettled(
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
      })
    }))
}

const issueCommentHandler: HandlerFunction<'issue_comment', unknown> = async (event) => {
  const { payload } = event

  const installationID = payload.installation?.id
  const repositoryID = payload.repository.id
  const { owner, repo } = parseRepoName(payload.repository.full_name)

  // Every PR is also an issues - GH API endpoint for issues is used for the shared functionality
  const issueID = payload.issue.id

  if (!installationID) {
    throw new Error('InstallationID not found')
  }

  const client = getGHInstallationClient({ installationID })

  const [prompt, deployments] = await Promise.all([
    getPromptFromPR({ client, issueID, repo, owner }),
    getDeploymentsForPR({ issueID, installationID, repositoryID }),
  ])

  await Promise.allSettled(
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
      })
    }))
}
