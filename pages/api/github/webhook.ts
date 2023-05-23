import { NextApiRequest, NextApiResponse } from 'next'

import { getGitHubWebhooksMiddleware } from 'github/webhooks'

const webhookHandler = getGitHubWebhooksMiddleware()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await (await webhookHandler)(req, res)
}
