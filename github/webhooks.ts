import type { HandlerFunction } from '@octokit/webhooks/dist-types/types'
import {
  Webhooks,
  createNodeMiddleware,
} from '@octokit/webhooks'
import { apps_content, apps } from 'database'

import { getAppContentFromRepo, getRepo } from './repoProcessing'
import { prisma } from 'queries/prisma'
import getClient from './installationClient'

export const branchRefPrefix = 'refs/heads/'

export async function getGitHubWebhooksMiddleware() {
  const webhooks = new Webhooks({
    secret: process.env.GITHUB_APP_WEBHOOK_SECRET!,
  })
  webhooks.on('push', pushHandler)
  return createNodeMiddleware(webhooks, { path: '/api/github/webhook' })
}

export async function deployLatestRepoState({
  repositoryFullName,
  installationID,
  apps,
  branch,
}: {
  repositoryFullName: string,
  installationID: number,
  branch: string,
  apps: Pick<apps, 'repository_path' | 'id'>[],
}) {
  const [repositoryOwnerName, repositoryName] = repositoryFullName.split('/')

  if (!installationID) {
    throw new Error('InstallationID not found')
  }

  const github = getClient({ installationID })
  const repo = await getRepo({
    github,
    repo: repositoryName,
    owner: repositoryOwnerName,
    ref: `${branchRefPrefix}${branch}`,
  })

  await Promise.all(apps.map(async app => {
    try {
      const content = await getAppContentFromRepo({
        dir: app.repository_path,
        repo,
      })

      if (!content) throw new Error('No content found in the repo')

      await prisma.apps_content.upsert({
        create: {
          content: content as unknown as NonNullable<apps_content['content']>,
          app_id: app.id,
        },
        update: {
          content: content as unknown as NonNullable<apps_content['content']>,
          updated_at: new Date(),
        },
        where: {
          app_id: app.id,
        }
      })
    } catch (err) {
      console.error(`Error deploying app "${app.id}" content from repository "${repositoryFullName}"`, err)
    }
  }))
}

const pushHandler: HandlerFunction<'push', unknown> = async (event) => {
  const { payload } = event
  const installationID = payload.installation?.id
  const repositoryID = payload.repository.id
  const branch = payload.ref.slice(branchRefPrefix.length)

  if (!installationID) {
    throw new Error('InstallationID not found')
  }

  const apps = await prisma.apps.findMany({
    where: {
      repository_branch: {
        equals: branch,
      },
      github_repositories: {
        repository_id: repositoryID,
      },
    },
  })

  if (apps.length === 0) return

  await deployLatestRepoState({
    apps,
    branch,
    installationID,
    repositoryFullName: payload.repository.full_name,
  })
}
