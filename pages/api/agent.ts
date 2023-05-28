import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { NextApiRequest, NextApiResponse } from 'next'

import { prisma } from 'db/prisma'
import { serverCreds } from 'db/credentials'
import { PostAgentBody } from 'pages/agent/smol-developer/setup'
import { getGHInstallationClient } from 'github/installationClient'
import { createAgentDeployment, createPR, getGHAccessToken, getGHAppInfo, triggerSmolDevAgentRun } from 'github/pullRequest'

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
          }
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

    const { issueID } = await createPR({
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

    const project = await prisma.projects.create({
      data: {
        deployments: {
          create: {
            auth: {
              github: {
                app_name: appInfo.name,
                app_email: appInfo.email,
                installation_id: installationID,
                repository_id: repositoryID,
                issue_id: issueID,
                branch,
                owner,
                repo,
              },
            },
            enabled: false,
          },
        },
        teams: {
          connectOrCreate: {
            where: {
              id: defaultTeam?.teams.id,
            },
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
          },
        },
        name: 'Smol developer',
      },
      include: {
        deployments: true
      },
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
    })

    res.status(200).json({
      owner,
      repo,
      issueID,
    })
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
