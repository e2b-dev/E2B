import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { NextApiRequest, NextApiResponse } from 'next'
import { nanoid } from 'nanoid'
import { client as posthog } from 'utils/posthog'

import { PostAgentResponse } from 'pages/agent/smol-developer/setup'
import { prisma } from 'db/prisma'
import { serverCreds } from 'db/credentials'
import { PostAgentBody } from 'pages/agent/smol-developer/setup'
import { getGHInstallationClient } from 'github/installationClient'
import {
  createAgentDeployment,
  createPR, getGHAccessToken,
  getGHAppInfo,
  prTitleFromInstructions,
  triggerSmolDevAgentRun,
} from 'github/pullRequest'

export interface DeploymentAuthData {
  github: {
    app_name: string,
    app_email: string,
    installation_id: number,
    repository_id: number,
    issue_id: number,
    pr_number: number,
    branch: string,
    owner: string,
    repo: string,
    pr_status: string,
    merged: boolean
    closed_at: null | string,
  }
}

export const prInfoText = `
---
*Trigger the agent again by adding instructions in a new PR comment or by editing existing instructions.*

*Powered by [e2b](https://app.e2b.dev/agent/smol-developer?utm_source=github)*
`

async function postAgent(req: NextApiRequest, res: NextApiResponse) {
  const {
    installationID,
    repositoryID,
    title,
    body,
    owner,
    templateID,
    branch,
    commitMessage,
    openAIKey,
    defaultBranch,
    repo,
    openAIModel,
  } = req.body as PostAgentBody

  try {
    const supabase = createServerSupabaseClient({ req, res }, serverCreds)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return res.status(401).json({
        error: 'not_authenticated',
        description: 'The user does not have an active session or is not authenticated',
      })
    }

    const user = await prisma.auth_users.findUnique({
      where: {
        id: session.user.id,
      },
      include: {
        users_teams: {
          include: {
            teams: true,
          },
        }
      },
    })
    if (!user) {
      return res.status(401).json({
        error: 'invalid_user',
      })
    }

    const defaultTeam = user.users_teams.find(t => t.teams.is_default)
    const client = getGHInstallationClient({ installationID })

    const appInfoPromise = getGHAppInfo({ client })

    const accessTokenPromise = getGHAccessToken({
      client,
      installationID,
      repositoryID,
    })

    const prTitle = await prTitleFromInstructions(body, openAIKey)

    if (!prTitle) {
      throw new Error('Generated PR title is empty')
    }

    const bodyWithInfo = `${body}${prInfoText}`

    const { issueID, number: pullNumber, url: pullURL } = await createPR({
      client,
      title: prTitle,
      defaultBranch,
      branch,
      commitMessage,
      body: bodyWithInfo,
      owner,
      repo,
    })

    posthog?.capture({
      distinctId: user.id,
      event: 'created PR when deploying agent',
      properties: {
        agent: templateID,
        repository: `${owner}/${repo}`,

        pr_action: 'created',
        pr_url: pullURL,
        pr_number: pullNumber,
      },
    })

    const appInfo = await appInfoPromise
    const authData: DeploymentAuthData = {
      github: {
        app_name: appInfo.name,
        app_email: appInfo.email,
        installation_id: installationID,
        repository_id: repositoryID,
        issue_id: issueID,
        pr_number: pullNumber,
        branch,
        owner,
        repo,
        pr_status: 'opened',
        merged: false,
        closed_at: null,
      },
    }

    const slug = `smoldev-${nanoid(3)}-${owner}-${repo}-pr-${pullNumber}`.toLowerCase()
    const project = await prisma.projects.create({
      data: {
        id: nanoid(),
        name: 'Smol developer',
        slug,
        deployments: {
          create: {
            auth: authData as any,
            enabled: false,
            config: {
              templateID,
              // OpenAI Model if OpenAI Key is provided
              ...(openAIKey && { openAIModel }),
            } as any,
            ...openAIKey && { secrets: JSON.stringify({ openAIKey }) },
          },
        },
        teams: {
          ...defaultTeam
            ? {
              connect: {
                id: defaultTeam.teams.id,
              },
            }
            : {
              create: {
                name: session.user.email || session.user.id,
                is_default: true,
                users_teams: {
                  create: {
                    users: {
                      connect: {
                        id: session.user.id,
                      },
                    },
                  },
                },
              },
            }
        },
      },
      include: {
        deployments: true,
      }
    })

    await createAgentDeployment({
      project_id: project.id,
      config: {
        templateID,
        // OpenAI Model if OpenAI Key is provided
        ...(openAIKey && { openAIModel }),
      } as any,
      secrets: { openAIKey } as any,
    })

    const deployment = project.deployments[0]
    // We started the process of getting the token earlier but we await it only now because we need in now
    const accessToken = await accessTokenPromise

    posthog?.capture({
      distinctId: user.id,
      event: 'created agent deployment',
      properties: {
        agent_deployment_id: deployment.id,
        agent: templateID,
        pr_url: pullURL,
        pr_number: pullNumber,
        repository: `${owner}/${repo}`,
        hasUserProvidedOpenAIKey: !!openAIKey,
      },
    })

    await triggerSmolDevAgentRun({
      deployment,
      prompt: body,
      accessToken,
      commitMessage: 'Add code based on the PR instructions',
      owner,
      repo,
      client,
      slug,
      totalRuns: 0,
      pullNumber,
    })

    const response: PostAgentResponse = {
      pullNumber,
      pullURL,
      issueID,
      owner,
      repo,
      projectID: project.id,
      projectSlug: slug,
    }

    posthog?.capture({
      distinctId: user.id,
      event: 'triggered deployed agent initial run',
      properties: {
        agent_deployment_id: deployment.id,
        agent: templateID,
        repository: `${owner}/${repo}`,

        pr_url: pullURL,
        pr_number: pullNumber,

        title,
        prompt: body,
      },
    })

    res.status(200).json(response)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ statusCode: 500, message: err.message })
  }
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === 'POST') {
    await postAgent(req, res)
    return
  }

  res.setHeader('Allow', 'POST')
  res.status(405).json({ statusCode: 405, message: 'Method Not Allowed' })
  return
}

export default handler
