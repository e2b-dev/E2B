import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { NextApiRequest, NextApiResponse } from 'next'

import { prisma } from 'db/prisma'
import { serverCreds } from 'db/credentials'
import { PostLogs } from 'utils/agentLogs'

async function postAgent(req: NextApiRequest, res: NextApiResponse) {
  const {
    logFiles,
    projectID,
  } = req.body as PostLogs

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
            teams: {
              include: {
                projects: {
                  select: {
                    id: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!user) {
      return res.status(401).json({
        error: 'invalid_user',
      })
    }

    const isInProject = user
      .users_teams
      .flatMap(t => t.teams.projects)
      .some(p => p.id === projectID)

    if (!isInProject) {
      return res.status(401).json({
        error: 'user_not_in_project',
      })
    }

    const logs = await prisma.logs.create({
      data: {
        data: logFiles as any,
        projects: {
          connect: {
            id: projectID,
          },
        },
      }
    })

    res.status(200).json({
      id: logs.id,
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
