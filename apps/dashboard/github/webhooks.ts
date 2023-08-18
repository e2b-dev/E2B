import type { HandlerFunction } from '@octokit/webhooks/dist-types/types'
import {
  Webhooks,
  createNodeMiddleware,
} from '@octokit/webhooks'

import { prisma } from 'db/prisma'
import { client as posthog } from 'utils/posthog'
import { DeploymentAuthData } from 'pages/api/agent'
import { smolDeveloperTemplateID } from 'utils/smolTemplates'

import {
  disableAgentDeployment,
  getDeploymentsForPR,
  getGHAccessToken,
  getPromptFromPR,
  triggerSmolDevAgentRun,
} from './pullRequest'
import { getGHInstallationClient } from './installationClient'

export async function getGitHubWebhooksMiddleware() {
  const webhooks = new Webhooks({
    secret: process.env.GITHUB_APP_WEBHOOK_SECRET!,
  })

  webhooks.on('issue_comment', issueCommentHandler)
  webhooks.on('pull_request.edited', pullRequestEditHandler)
  webhooks.on('pull_request.reopened', pullRequestReopenedHandler)
  webhooks.on('pull_request.closed', pullRequestClosedHandler)

  return createNodeMiddleware(webhooks, {
    path: '/api/github/webhook',
    log: {
      debug: console.log,
      info: console.log,
      warn: console.log,
      error: console.error,
    },
  })
}

const pullRequestReopenedHandler: HandlerFunction<'pull_request.reopened', unknown> = async (event) => {
  const { payload } = event

  const installationID = payload.installation?.id
  const repositoryID = payload.repository.id

  // Every PR is also an issues - GH API endpoint for issues is used for the shared functionality
  const issueID = payload.pull_request.id

  if (!installationID) {
    throw new Error('InstallationID not found')
  }

  const deployments = await getDeploymentsForPR({ issueID, installationID, repositoryID, enabled: undefined })

  if (deployments.length === 0) {
    console.log('No deployments found')
    return
  }

  const res = await Promise.allSettled(deployments.map(async d => {
    await prisma.deployments.update({
      where: {
        id: d.id,
      },
      data: {
        enabled: true,
      },
    })

    const auth: DeploymentAuthData = {
      ...d.auth as any,
      github: {
        ...(d.auth as unknown as DeploymentAuthData).github,
        pr_status: payload.pull_request.state,
        pr_merged: payload.pull_request.merged,
        pr_closed_at: payload.pull_request.closed_at,
      }
    }

    await prisma.deployments.update({
      where: {
        id: d.id,
      },
      data: {
        auth: auth as any,
      },
    })

    d
      .projects
      .teams
      .users_teams
      .map(team => team.users)
      .flat()
      .forEach(user => {
        posthog?.capture({
          distinctId: user.id,
          event: 'reopened PR created by agent',
          properties: {
            agent_deployment_id: d.id,
            agent: smolDeveloperTemplateID,
            repository: payload.repository.full_name,
            repository_url: payload.repository.html_url,

            pr_action: payload.action,
            pr_url: payload.pull_request.html_url,
            pr_number: payload.pull_request.number,

            prompt: d.last_finished_prompt,
            title: payload.pull_request.title,
            merged: payload.pull_request.merged,
          },
        })
      })
  }))

  await posthog?.shutdownAsync()

  console.log('Reopened PRs', res)
}

const pullRequestClosedHandler: HandlerFunction<'pull_request.closed', unknown> = async (event) => {
  const { payload } = event
  const installationID = payload.installation?.id
  const repositoryID = payload.repository.id

  // Every PR is also an issues - GH API endpoint for issues is used for the shared functionality
  const issueID = payload.pull_request.id

  if (!installationID) {
    throw new Error('InstallationID not found')
  }

  const deployments = await getDeploymentsForPR({ issueID, installationID, repositoryID, enabled: undefined })

  if (deployments.length === 0) {
    console.log('No deployments found')
    return
  }

  const res = await Promise.allSettled(deployments.map(async d => {
    await disableAgentDeployment({
      id: d.id,
    })

    const auth: DeploymentAuthData = {
      ...d.auth as any,
      github: {
        ...(d.auth as unknown as DeploymentAuthData).github,
        pr_status: payload.pull_request.state,
        pr_merged: payload.pull_request.merged,
        pr_closed_at: payload.pull_request.closed_at,
      }
    }

    await prisma.deployments.update({
      where: {
        id: d.id,
      },
      data: {
        auth: auth as any,
      },
    })

    d
      .projects
      .teams
      .users_teams
      .map(team => team.users)
      .flat()
      .forEach(user => {
        posthog?.capture({
          distinctId: user.id,
          event: 'closed PR created by agent',
          properties: {
            agent_deployment_id: d.id,
            agent: smolDeveloperTemplateID,
            repository: payload.repository.full_name,
            repository_url: payload.repository.html_url,

            pr_action: payload.action,
            pr_url: payload.pull_request.html_url,
            pr_number: payload.pull_request.number,

            prompt: d.last_finished_prompt,
            title: payload.pull_request.title,
            merged: payload.pull_request.merged,
          },
        })
      })
  }))

  await posthog?.shutdownAsync()
  console.log('Closed PRs', res)
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
    getDeploymentsForPR({ issueID, installationID, repositoryID, enabled: true }),
  ])

  if (deployments.length === 0) {
    console.log('No deployments found')
    return
  }

  const res = await Promise.allSettled(
    deployments.map(async d => {
      const accessToken = await getGHAccessToken({
        client,
        installationID,
        repositoryID,
      })
      await triggerSmolDevAgentRun({
        prompt,
        deployment: d,
        accessToken,
        commitMessage: 'Update based on PR comments',
        owner,
        repo,
        client,
        totalRuns: d._count.log_files,
        slug: d.projects.slug,
        pullNumber: issueNumber,
      })

      d
        .projects
        .teams
        .users_teams
        .map(team => team.users)
        .flat()
        .forEach(user => {
          posthog?.capture({
            distinctId: user.id,
            event: 'triggered agent with PR action',
            properties: {
              agent_deployment_id: d.id,
              agent: smolDeveloperTemplateID,
              repository: payload.repository.full_name,
              repository_url: payload.repository.html_url,

              pr_action: payload.action,
              pr_url: payload.pull_request.html_url,
              pr_number: issueNumber,

              prompt,
              title: payload.pull_request.title,
              pr_body: payload.pull_request.body,
            },
          })
        })
    }))

  await posthog?.shutdownAsync()
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
    getDeploymentsForPR({ issueID: pr.data.id, installationID, repositoryID, enabled: true }),
  ])

  if (deployments.length === 0) {
    console.log('No deployments found')
    return
  }

  const res = await Promise.allSettled(
    deployments.map(async d => {
      const accessToken = await getGHAccessToken({
        client,
        installationID,
        repositoryID,
      })
      await triggerSmolDevAgentRun({
        prompt,
        deployment: d,
        slug: d.projects.slug,
        totalRuns: d._count.log_files,
        accessToken,
        owner,
        repo,
        commitMessage: 'Update based on PR comments',
        client,
        pullNumber,
      })
      d
        .projects
        .teams
        .users_teams
        .map(team => team.users)
        .flat()
        .forEach(user => {
          posthog?.capture({
            distinctId: user.id,
            event: 'triggered agent by PR comment action',
            properties: {
              agent_deployment_id: d.id,
              agent: smolDeveloperTemplateID,
              repository: payload.repository.full_name,
              repository_url: payload.repository.html_url,

              pr_comment_action: payload.action,
              pr_url: pr.data.html_url,
              pr_number: pr.data.number,

              prompt,
              title: pr.data.title,
              comment_body: payload.comment.body,
            },
          })
        })
    }))

  await posthog?.shutdownAsync()

  console.log('Trigger results', res)
}
