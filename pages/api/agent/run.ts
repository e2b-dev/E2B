import { NextApiRequest, NextApiResponse } from 'next'

import { prisma } from 'db/prisma'
import { getGHInstallationClient } from 'github/installationClient'
import { addCommentToPR } from 'github/pullRequest'
import { DeploymentAuthData } from '.'


// Indicate that the agent state changed (run finished)
async function postRun(req: NextApiRequest, res: NextApiResponse) {
  const {
    deployment_id,
    prompt,

  } = req.body as { prompt: string, deployment_id: string }

  const header = req.headers.authorization
  // Extract the token from the header
  const token = header?.split(' ')[1]
  if (process.env.SECRET_TOKEN && token !== process.env.SECRET_TOKEN) {
    console.log('Invalid token', token, process.env.SECRET_TOKEN)
    throw new Error('Invalid token')
  }

  const deployment = await prisma.deployments.update({
    where: {
      id: deployment_id,
    },
    data: {
      last_finished_prompt: prompt,
    },
  })

  const authData = deployment.auth as unknown as DeploymentAuthData
  const client = getGHInstallationClient({ installationID: authData.github.installation_id })


  // TODO: Should we maybe just edit the previous comment?
  // Or should we do that only if the previous run was cancelled
  await addCommentToPR({
    body: 'Finished running the agent',
    client,
    owner: authData.github.owner,
    repo: authData.github.repo,
    pullNumber: authData.github.pull_number,
  })
}

// Indicate that the agent state changed (run cancelled)
async function deleteRun(req: NextApiRequest, res: NextApiResponse) {
  const {
    deployment_id,
  } = req.body as { deployment_id: string }

  const header = req.headers.authorization
  // Extract the token from the header
  const token = header?.split(' ')[1]
  if (process.env.SECRET_TOKEN && token !== process.env.SECRET_TOKEN) {
    console.log('Invalid token', token, process.env.SECRET_TOKEN)
    throw new Error('Invalid token')
  }

  const deployment = await prisma.deployments.findUniqueOrThrow({
    where: {
      id: deployment_id,
    },
  })

  const authData = deployment.auth as unknown as DeploymentAuthData
  const client = getGHInstallationClient({ installationID: authData.github.installation_id })

  // Add comment about the run being cancelled
  // TODO: Maybe just edit the previous comment?
  await addCommentToPR({
    body: 'Run cancelled',
    client,
    owner: authData.github.owner,
    repo: authData.github.repo,
    pullNumber: authData.github.pull_number,
  })
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method === 'POST') {
    await postRun(req, res)
    return
  }
  if (req.method === 'DELETE') {
    await deleteRun(req, res)
    return
  }

  res.setHeader('Allow', ['POST', 'DELETE'])
  res.status(405).json({ statusCode: 405, message: 'Method Not Allowed' })
  return
}

export default handler
