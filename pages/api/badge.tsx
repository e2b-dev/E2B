import { NextApiRequest, NextApiResponse } from 'next'
import { ImageResponse } from '@vercel/og'

import BadgeImg from 'components/Badge'

export const config = {
  runtime: 'edge',
}

function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  return new ImageResponse(
    (
      <BadgeImg/>
    ),
    {
      width: 141,
      height: 30,
    },
  )
}

export default handler