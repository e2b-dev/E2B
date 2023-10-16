import * as commander from 'commander'
import * as commonTags from 'common-tags'
import * as fs from 'fs'
import * as fsPromise from 'fs/promises'
import * as fData from 'formdata-node' // Remove formdata-node when dropping node 16 support
import * as nodeFetch from 'node-fetch'
import * as path from 'path'
import * as e2b from '@e2b/sdk'

import { wait } from 'src/utils/wait'
import { ensureAccessToken } from 'src/api'
import { getFiles, getRoot } from 'src/utils/filesystem'
import {
  asBold,
  asFormattedEnvironment,
  asFormattedError,
  asLocalRelative,
} from 'src/utils/format'
import { pathOption } from 'src/options'
import { createBlobFromFiles } from 'src/docker/archive'

const envCheckInterval = 1_000 // 1 sec
const maxBuildTime = 10 * 60 * 1_000 // 10 min

const getEnv = e2b.withAccessToken(e2b.api.path('/envs/{envID}').method('get').create())

export const buildCommand = new commander.Command('build')
  .description('Build environment')
  .argument(
    '[id]',
    `Specify ${asBold(
      '[id]',
    )} to rebuild an existing environment. Otherwise, a new environment will be created.`,
  )
  .addOption(pathOption)
  .option(
    '-G, --no-gitignore',
    `Ignore ${asLocalRelative('.gitignore')} file in the root directory`,
  )
  .option(
    '-D, --no-dockerignore',
    `Ignore ${asLocalRelative('.dockerignore')} file in the root directory`,
  )
  .alias('bd')
  .action(
    async (
      id: string | undefined,
      opts: { path?: string; gitignore?: boolean; dockerignore?: boolean },
    ) => {
      try {
        const accessToken = ensureAccessToken()
        process.stdout.write('\n')

        const root = getRoot(opts.path)

        const filePaths = await getFiles(root, {
          respectGitignore: opts.gitignore,
          respectDockerignore: opts.dockerignore,
        })

        if (!filePaths.length) {
          console.log(commonTags.stripIndent`
          No allowed files found in ${asLocalRelative(root)}.
          Note that .gitignore and .dockerignore files are respected by default when building the environment via from Dockerfile,
          use --no-gitignore and --no-dockerignore to override.
       `)
          return
        }

        const dockerFilePath = path.join(root, 'Dockerfile')
        if (!fs.existsSync(dockerFilePath)) {
          throw new Error('No Dockerfile found in the root directory')
        }

        console.log(
          `Preparing environment build (${filePaths.length} files in Docker build context)`,
        )

        const formData = new fData.FormData()

        const dockerfileContent = await fsPromise.readFile(dockerFilePath, 'utf-8')
        formData.append('dockerfile', dockerfileContent)

        if (id) {
          formData.append('envID', id)
        }

        // It should be possible to pipe directly to the API
        // instead of creating a blob in memory then streaming.
        const blob = await createBlobFromFiles(root, filePaths)
        formData.append('buildContext', blob, 'env.tar.gz.e2b')

        const apiRes = await nodeFetch.default(`https://${e2b.API_DOMAIN}/envs`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: formData,
        })

        if (!apiRes.ok) {
          const resJson = (await apiRes.json()) as { message: string }
          console.log('res', resJson)
          throw new Error(
            `API request failed: ${apiRes.statusText}, ${resJson?.message ?? 'no message'
            }`,
          )
        }
        const resJson = (await apiRes.json()) as {
          envID: string
          public: boolean
          status: 'building' | 'error' | 'ready'
        }
        console.log(`Started building environment ${asFormattedEnvironment(resJson)}`)

        await waitForBuildFinish(accessToken, resJson.envID)
      } catch (err: unknown) {
        console.error(asFormattedError((err as Error).message), err)
        process.exit(1)
      }
    },
  )

async function waitForBuildFinish(accessToken: string, envID: string) {
  const startedAt = new Date()
  let logsOffset = 0

  function elapsed() {
    return Date.now() - startedAt.getTime()
  }

  let env: Awaited<ReturnType<typeof getEnv>> | undefined

  do {
    await wait(envCheckInterval)
    env = await getEnv(accessToken, { envID, logs: logsOffset })
    logsOffset += env.data.logs.length

    switch (env.data.status) {
      case 'building':
        env.data.logs.forEach(console.log)
        break
      case 'ready':
        console.log(
          `✅ \nBuilding environment ${asFormattedEnvironment(env.data)} finished`,
        )
        break

      case 'error':
        throw new Error(
          `\nBuilding environment ${asFormattedEnvironment(env.data)} failed`,
        )
    }
  } while (env.data.status === 'building' && elapsed() < maxBuildTime)
}
