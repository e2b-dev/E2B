import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { NextApiRequest, NextApiResponse } from 'next'

import { prisma } from 'db/prisma'
import { serverCreds } from 'db/credentials'
import { PostFeedback } from 'hooks/useAddFeedback'

async function postFeedback(req: NextApiRequest, res: NextApiResponse) {
  const {
    feedback,
  } = req.body as PostFeedback

  try {
    const supabase = createServerSupabaseClient({ req, res }, serverCreds)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return res.status(401).json({
        error: 'not_authenticated',
        description: 'The user does not have an active session or is not authenticated',
      })
    }

    await prisma.feedback.create({
      data: {
        text: feedback,
        email: session.user.email,
        users: {
          connect: {
            id: session.user.id,
          },
        },
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
    await postFeedback(req, res)
    return
  }

  res.setHeader('Allow', 'POST')
  res.status(405).json({ statusCode: 405, message: 'Method Not Allowed' })
  return
}

export default handler
