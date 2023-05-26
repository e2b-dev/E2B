import type { HandlerFunction } from '@octokit/webhooks/dist-types/types'
import {
  Webhooks,
  createNodeMiddleware,
} from '@octokit/webhooks'
import api from 'api-client/api'

import { prisma } from 'db/prisma'

export async function getGitHubWebhooksMiddleware() {
  const webhooks = new Webhooks({
    secret: process.env.GITHUB_APP_WEBHOOK_SECRET!,
  })

  webhooks.on('issue_comment', issueCommentHandler)

  // webhooks.on('pull_request', async (event) => {
  //   event.payload.
  // })

  // TODO: Add handling for review comments
  // webhooks.on('pull_request_review_comment', async (event) => {
  //   event.payload.
  // })

  return createNodeMiddleware(webhooks, { path: '/api/github/webhook' })
}

async function getPromptFromIssues(issue: Issue): Promise<string> {

}

const interactWithDeployedSmolAgent = api.path('/deployments/{id}/interactions').method('post').create()

const issueCommentHandler: HandlerFunction<'issue_comment', unknown> = async (event) => {
  const { payload } = event

  const installationID = payload.installation?.id
  const repositoryID = payload.repository.id
  // Every PR is also an issues - GH API endpoint for issues is used for the shared functionality
  const issueID = payload.issue.id

  if (!installationID) {
    throw new Error('InstallationID not found')
  }

  const prompt = await getPromptFromIssues(payload.issue)

  // TODO: Ignore GH comments made by Agent
  const deployments = await prisma.deployments.findMany({
    where: {
      AND: [
        {
          auth: {
            path: ['github', 'installation_id'],
            equals: installationID,
          },
        },
        {
          auth: {
            path: ['github', 'repository_id'],
            equals: repositoryID,
          },
        }
      ],
    },
  })

  await Promise.allSettled(
    deployments.map(
      async deployment => interactWithDeployedSmolAgent({
        id: deployment.id,
        type: 'start',
        data: {
          instructions: {
            Prompt: prompt,
            AccessToken: '',
            RepositoryURL: '',
            Branch: '',
            IssueID: issueID,
          },
        } as any,
      })
    ))
}
