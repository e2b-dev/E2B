import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { NextApiRequest, NextApiResponse } from 'next'

import { prisma } from 'db/prisma'
import { serverCreds } from 'db/credentials'

async function getLog(req: NextApiRequest, res: NextApiResponse) {
  let {
    ':logFileID': logFileID,
  } = req.query

  console.log('getting log >>>>')

  try {
    if (!logFileID) {
      res.status(400).json({ statusCode: 400, message: 'Missing log ID in URL' })
      return
    }
    logFileID = logFileID as string

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
                    log_files: {
                      where: {
                        id: logFileID,
                      },
                    }
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
      .flatMap(p => p.log_files)
      .some(l => l.id === logFileID)

    if (!hasAccessToLogs) {
      return res.status(401).json({
        error: 'logs_does_not_belong_to_user',
      })
    }

    const logFile = await prisma.log_files.findUnique({
      where: {
        id: logFileID,
      },
    })
    res.status(200).json(logFile)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ statusCode: 500, message: err.message })
  }
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === 'GET') {
    await getLog(req, res)
    return
  }

  res.setHeader('Allow', ['GET'])
  res.status(405).json({ statusCode: 405, message: 'Method Not Allowed' })
  return
}

export default handler
