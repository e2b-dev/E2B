import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { NextApiRequest, NextApiResponse } from 'next'

import { prisma } from 'db/prisma'
import { serverCreds } from 'db/credentials'
import type { DeleteProjectBody } from 'components/AgentOverview'

async function deleteProject(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.body as DeleteProjectBody

  try {
    const supabase = createServerSupabaseClient({ req, res }, serverCreds)
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
  if (req.method === 'DELETE') {
    await deleteProject(req, res)
    return
  }

  res.setHeader('Allow', ['DELETE'])
  res.status(405).json({ statusCode: 405, message: 'Method Not Allowed' })
  return
}

export default handler
