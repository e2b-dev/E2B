import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { NextApiRequest, NextApiResponse } from 'next'

import { prisma } from 'db/prisma'
import { serverCreds } from 'db/credentials'
import { DeleteLogUploadTag } from 'hooks/useDeleteLogUploadTag'
import { PostLogUploadTag } from 'hooks/useAddLogUploadTag'

async function deleteLogUploadTag(req: NextApiRequest, res: NextApiResponse) {
  const {
    id,
    tag,
  } = req.body as DeleteLogUploadTag

  try {
    const supabase = createServerSupabaseClient({ req, res }, serverCreds)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return res.status(401).json({
        error: 'not_authenticated',
        description: 'The user does not have an active session or is not authenticated',
      })
    }

    const log = await prisma.log_uploads.findFirstOrThrow({
      where: {
        id,
        projects: {
          teams: {
            users_teams: {
              some: {
                user_id: session.user.id,
              },
            },
          },
        },
      },
    })

    await prisma.log_uploads.update({
      where: {
        id,
      },
      data: {
        tags: (log.tags as any[]).filter(t => t.path !== tag.path || t.text !== tag.text),
      },
    })

    res.status(200).json({})
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ statusCode: 500, message: err.message })
  }
}

async function postLogUploadTag(req: NextApiRequest, res: NextApiResponse) {
  const {
    id,
    tag,
  } = req.body as PostLogUploadTag

  try {
    const supabase = createServerSupabaseClient({ req, res }, serverCreds)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return res.status(401).json({
        error: 'not_authenticated',
        description: 'The user does not have an active session or is not authenticated',
      })
    }

    const log = await prisma.log_uploads.findFirstOrThrow({
      where: {
        id,
        projects: {
          teams: {
            users_teams: {
              some: {
                user_id: session.user.id,
              },
            },
          },
        },
      },
    })

    await prisma.log_uploads.update({
      where: {
        id,
      },
      data: {
        tags: [...log.tags as any[], tag],
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
    await postLogUploadTag(req, res)
    return
  }

  if (req.method === 'DELETE') {
    await deleteLogUploadTag(req, res)
    return
  }

  res.setHeader('Allow', ['POST', 'DELETE'])
  res.status(405).json({ statusCode: 405, message: 'Method Not Allowed' })
  return
}

export default handler
