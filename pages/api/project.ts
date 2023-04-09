import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { NextApiRequest, NextApiResponse } from 'next'

import { prisma } from 'db/prisma'

export interface PostProjectBody {
  id: string
}

async function postProject(req: NextApiRequest, res: NextApiResponse) {
  const {
    id,
  } = req.body as PostProjectBody

  try {
    const supabase = createServerSupabaseClient({ req, res })
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
    if (!defaultTeam) {
      return res.status(401).json({
        error: 'invalid_default_team',
      })
    }

    const project = await prisma.projects.create({
      data: {
        id,
        teams: {
          connect: {
            id: defaultTeam.teams.id,
          },
        },
        name: id,
      },
      select: {
        created_at: false,
        id: true,
      }
    })

    res.status(200).json(project)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ statusCode: 500, message: err.message })
  }
}

async function deleteProject(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.body as PostProjectBody

  try {
    const supabase = createServerSupabaseClient({ req, res })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return res.status(401).json({
        error: 'not_authenticated',
        description: 'The user does not have an active session or is not authenticated',
      })
    }

    const project = await prisma.projects.findFirst({
      where: {
        AND: [
          {
            id: {
              equals: id,
            }
          },
          {
            teams: {
              users_teams: {
                some: {
                  user_id: {
                    equals: session.user.id,
                  },
                },
              },
            },
          },
        ],
      },
    })

    if (!project) {
      res.status(404).json({})
      return
    }

    await prisma.deployments.deleteMany({
      where: {
        project_id: id,
      },
    })

    await prisma.projects.delete({
      where: {
        id,
      },
    })

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
    await postProject(req, res)
    return
  }
  if (req.method === 'DELETE') {
    await deleteProject(req, res)
    return
  }

  res.setHeader('Allow', 'POST')
  res.status(405).json({ statusCode: 405, message: 'Method Not Allowed' })
  return
}

export default handler
