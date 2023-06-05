import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { NextApiRequest, NextApiResponse } from 'next'
import { nanoid } from 'nanoid'
import { client as posthog } from 'utils/posthog'

import { PostAgentResponse } from 'pages/agent/smol-developer/setup'
import { prisma } from 'db/prisma'
import { serverCreds } from 'db/credentials'
import { PostAgentBody } from 'pages/agent/smol-developer/setup'
import { getGHInstallationClient } from 'github/installationClient'
import { createAgentDeployment, createPR, getGHAccessToken, getGHAppInfo, triggerSmolDevAgentRun } from 'github/pullRequest'
import { TemplateID } from 'state/template'

export interface DeploymentAuthData {
  github: {
    app_name: string,
    app_email: string,
    installation_id: number,
    repository_id: number,
    issue_id: number,
    pull_number: number,
    branch: string,
    owner: string,
    repo: string,
  }
}

async function postAgent(req: NextApiRequest, res: NextApiResponse) {
  const {
    installationID,
    repositoryID,
    title,
    body,
    owner,
    modelConfig,
    branch,
    commitMessage,
    defaultBranch,
    repo,
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

    const { issueID, number: pullNumber, url: pullURL } = await createPR({
      client,
      title,
      defaultBranch,
      branch,
      commitMessage,
      body,
      owner,
      repo,
    })

    const appInfo = await appInfoPromise

    const authData: DeploymentAuthData = {
      github: {
        app_name: appInfo.name,
        app_email: appInfo.email,
        installation_id: installationID,
        repository_id: repositoryID,
        issue_id: issueID,
        pull_number: pullNumber,
        branch,
        owner,
        repo,
      },
    }

    const project = await prisma.projects.create({
      data: {
        id: nanoid(),
        name: 'Smol developer',
        deployments: {
          create: {
            auth: authData as any,
            enabled: false,
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
      config: modelConfig as any,
    })

    const deployment = project.deployments[0]
    // We started the process of getting the token earlier but we await it only now because we need in now
    const accessToken = await accessTokenPromise

    await triggerSmolDevAgentRun({
      deployment,
      prompt: body,
      accessToken,
      commitMessage: 'Add code based on the PR description',
      owner,
      repo,
      client,
      pullNumber,
    })

    const response: PostAgentResponse = {
      pullNumber,
      pullURL,
      issueID,
      owner,
      repo,
    }

    posthog?.capture({
      distinctId: user.id,
      event: 'triggered intial agent run',
      properties: {
        agent: TemplateID.SmolDeveloper,
        pr_url: pullURL,
        repository: `${owner}/${repo}`,
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
