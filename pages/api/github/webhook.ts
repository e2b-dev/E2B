import { NextApiRequest, NextApiResponse } from 'next'
import Cors from 'micro-cors'

import { getGitHubWebhooksMiddleware } from 'github/webhooks'

const webhookHandler = getGitHubWebhooksMiddleware()

export const config = {
  api: {
    bodyParser: false,
  },
}

const cors = Cors({
  allowMethods: ['POST', 'HEAD'],
})

async function handler(req: NextApiRequest, res: NextApiResponse) {
  await (await webhookHandler)(req, res)
}

export default cors(handler as any)
