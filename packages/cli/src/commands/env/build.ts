import * as commander from 'commander'
import * as commonTags from 'common-tags'
import * as fs from 'fs'
import * as fsPromise from 'fs/promises'
import * as Blob from 'cross-blob' // Remove cross-blob when dropping node 16 support
// Remove cross-blob when dropping node 16 support
import * as fData from 'formdata-node' // Remove formdata-node when dropping node 16 support
import * as nodeFetch from 'node-fetch'
import * as path from 'path'
import * as e2b from '@e2b/sdk'
import * as tar from 'tar-fs'

import { wait } from 'src/utils/wait'
import { ensureAccessToken } from 'src/api'
import { getFiles, getRoot } from 'src/utils/filesystem'
import { asBold, asFormattedError, asLocal, asLocalRelative } from 'src/utils/format'
import { pathOption } from 'src/options'

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
          No files found in ${asLocalRelative(root)}.
          Note that .gitignore and .dockerignore files are respected by default,
          use --no-gitignore and --no-dockerignore to override.
       `)
          return
        }

        console.log('📦 Files to be uploaded to create environment:')
        filePaths.forEach(filePath => {
          console.log(`• ${filePath.rootPath}`)
        })

        const dockerFilePath = path.join(root, 'Dockerfile')

        if (!fs.existsSync(dockerFilePath)) {
          throw new Error('No Dockerfile found in the root directory.')
        }

        const formData = new fData.FormData()

        const dockerfileContent = await fsPromise.readFile(dockerFilePath, 'utf-8')
        formData.append('dockerfile', dockerfileContent)

        if (id) {
          formData.append('envID', id)
        }

        // It should be possible to pipe directly to the API
        // instead of creating a blob in memory then streaming.
        const blob = await new Promise<Blob>((resolve, reject) => {
          const chunks: any[] = []

          const pack = tar.pack(root, {
            entries: filePaths.map(({ rootPath }) => rootPath),
          })

          pack.on('data', chunk => {
            chunks.push(chunk)
          })

          pack.on('end', () => {
            const blob = new Blob.default(chunks)
            resolve(blob)
          })

          pack.on('error', error => {
            reject(new Error(`Error creating tar blob: ${error.message}`))
          })
        })

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
        console.log(`✅ Env created: ${resJson?.envID}, waiting for build to finish...`)

        const startedAt = new Date()
        let completed = false

        while (!completed) {
          await wait(2000)

          const envResponse = await getEnv(accessToken, {
            envID: resJson.envID,
          })

          const env = envResponse.data

          if (env.status === 'building') {
            const now = new Date()
            const elapsed = now.getTime() - startedAt.getTime()
            const elapsedStr = `${Math.floor(elapsed / 1000)}s`
            console.log(`⏳ Building… (started ${elapsedStr} ago)`) // nicer
            if (elapsed > 1000 * 60 * 2) {
              console.log(commonTags.stripIndent`
              ⚠️ Build taking longer than 2 minutes, something might be wrong.
              Stopping to wait for result, but it might still finish.
              Check by yourself by running ${asLocal('e2b env list')}
            `)
              completed = true
            }
          } else if (env.status === 'ready') {
            completed = true
            console.log('✅ Build completed')
          } else if (env.status === 'error') {
            throw new Error('Build failed')
          }
        }
      } catch (err: unknown) {
        console.error(asFormattedError((err as Error).message), err)
        process.exit(1)
      }
    },
  )
