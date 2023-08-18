import { NextApiRequest, NextApiResponse } from 'next'

import { prisma } from 'db/prisma'
import { getGHInstallationClient } from 'github/installationClient'
import { addCommentToPR } from 'github/pullRequest'
import { client as posthog } from 'utils/posthog'

import { DeploymentAuthData } from '.'
import { smolDeveloperTemplateID } from 'utils/smolTemplates'

// Indicate that the agent state changed (run finished)
async function postRun(req: NextApiRequest, res: NextApiResponse) {
  try {
    const {
      deployment_id,
      prompt,
      run_id,
    } = req.body as {
      prompt: string,
      deployment_id: string,
      run_id: string,
    }

    const header = req.headers.authorization
    // Extract the token from the header
    const token = header?.split(' ')[1]
    if (process.env.SECRET_TOKEN && token !== process.env.SECRET_TOKEN) {
      console.log('Invalid token', token, process.env.SECRET_TOKEN)
      throw new Error('Invalid token')
    }

    const deployment = await prisma.deployments.update({
      where: {
        id: deployment_id,
      },
      data: {
        last_finished_prompt: prompt,
      },
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
    })

    const authData = deployment.auth as unknown as DeploymentAuthData
    const client = getGHInstallationClient({ installationID: authData.github.installation_id })

    // TODO: Should we maybe just edit the previous comment?
    // Or should we do that only if the previous run was cancelled
    await addCommentToPR({
      body: `Finished smol developer [agent run](https://app.e2b.dev/logs/${deployment.projects.slug}-run-${deployment._count.log_files - 1}?utm_source=github).\n\n*Trigger the agent again by adding instructions in a new PR comment or by editing existing instructions.*`,
      client,
      owner: authData.github.owner,
      repo: authData.github.repo,
      pullNumber: authData.github.pr_number,
    })

    const users = deployment
      .projects
      .teams
      .users_teams
      .map(u => u.users)
      .flat()

    const result = await Promise.allSettled(users.map(async u => {
      posthog?.capture({
        distinctId: u.id,
        event: 'finished agent run',
        properties: {
          agent_deployment_id: deployment.id,
          agent: smolDeveloperTemplateID,
          repository: `${authData.github.owner}/${authData.github.repo}`,
          run_id,

          pr_number: authData.github.pr_number,
        },
      })
    }))

    await posthog?.shutdownAsync()
    console.log('Analytics logged', result)

    res.status(200).json({})
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ statusCode: 500, message: err.message })
  }
}

// Indicate that the agent state changed (run cancelled)
async function deleteRun(req: NextApiRequest, res: NextApiResponse) {
  try {
    const {
      deployment_id,
      run_id,
    } = req.body as {
      deployment_id: string,
      run_id: string,
    }

    const header = req.headers.authorization
    // Extract the token from the header
    const token = header?.split(' ')[1]
    if (process.env.SECRET_TOKEN && token !== process.env.SECRET_TOKEN) {
      console.log('Invalid token', token, process.env.SECRET_TOKEN)
      throw new Error('Invalid token')
    }

    const deployment = await prisma.deployments.findUniqueOrThrow({
      where: {
        id: deployment_id,
      },
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
    })

    const authData = deployment.auth as unknown as DeploymentAuthData
    const client = getGHInstallationClient({ installationID: authData.github.installation_id })

    if (deployment.enabled) {
      // Add comment about the run being cancelled
      await addCommentToPR({
        body: `Cancelled smol developer [agent run](https://app.e2b.dev/logs/${deployment.projects.slug}-run-${deployment._count.log_files - 1}?utm_source=github).`,
        client,
        owner: authData.github.owner,
        repo: authData.github.repo,
        pullNumber: authData.github.pr_number,
      })
    }

    const users = deployment
      .projects
      .teams
      .users_teams
      .map(u => u.users)
      .flat()

    const result = await Promise.allSettled(users.map(async u => {
      posthog?.capture({
        distinctId: u.id,
        event: 'cancelled agent run',
        properties: {
          agent_deployment_id: deployment.id,
          agent: smolDeveloperTemplateID,
          repository: `${authData.github.owner}/${authData.github.repo}`,
          run_id,

          pr_number: authData.github.pr_number,
        },
      })
    }))

    await posthog?.shutdownAsync()
    console.log('Analytics logged', result)

    res.status(200).json({})
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
    await postRun(req, res)
    return
  }
  if (req.method === 'DELETE') {
    await deleteRun(req, res)
    return
  }

  res.setHeader('Allow', ['POST', 'DELETE'])
  res.status(405).json({ statusCode: 405, message: 'Method Not Allowed' })
  return
}

export default handler
