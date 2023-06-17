import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { NextApiRequest, NextApiResponse } from 'next'

import { prisma } from 'db/prisma'
import { serverCreds } from 'db/credentials'
import { PostLogs } from 'hooks/useUploadLogs'
import { DeleteLogs } from 'hooks/useRemoveLogs'

async function deleteLogs(req: NextApiRequest, res: NextApiResponse) {
  const {
    id,
  } = req.body as DeleteLogs

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
                  include: {
                    log_uploads: {
                      where: {
                        id,
                      },
                    },
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

    const hasAccessToLogs = user
      .users_teams
      .flatMap(t => t.teams.projects)
      .flatMap(p => p.log_uploads)
      .some(l => l.id === id)

    if (!hasAccessToLogs) {
      return res.status(401).json({
        error: 'logs_does_not_belong_to_user',
      })
    }

    await prisma.log_uploads.delete({
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

async function postLogs(req: NextApiRequest, res: NextApiResponse) {
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

    const logs = await prisma.log_uploads.create({
      data: {
        projects: {
          connect: {
            id: projectID,
          },
        },
        log_files: {
          createMany: {
            data: logFiles.map(l => ({
              ...l,
              project_id: projectID,
            })),
          },
        },
      },
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
    await postLogs(req, res)
    return
  }

  if (req.method === 'DELETE') {
    await deleteLogs(req, res)
    return
  }

  res.setHeader('Allow', ['POST', 'DELETE'])
  res.status(405).json({ statusCode: 405, message: 'Method Not Allowed' })
  return
}

export default handler
