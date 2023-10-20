import * as commander from 'commander'
import * as commonTags from 'common-tags'
import * as fs from 'fs'
import * as path from 'path'
import * as e2b from '@e2b/sdk'
import { FormData } from 'formdata-polyfill/esm.min.js'

import { wait } from 'src/utils/wait'
import { ensureAccessToken } from 'src/api'
import { getFiles, getRoot } from 'src/utils/filesystem'
import {
  asBold,
  asBuildLogs,
  asFormattedEnvironment,
  asLocal,
  asLocalRelative,
} from 'src/utils/format'
import { pathOption } from 'src/options'
import { createBlobFromFiles } from 'src/docker/archive'
import { defaultDockerfileName, fallbackDockerfileName } from 'src/docker/constants'

const envCheckInterval = 1_000 // 1 sec
const maxBuildTime = 10 * 60 * 1_000 // 10 min

const getEnv = e2b.withAccessToken(
  e2b.api.path('/envs/{envID}/builds/{buildID}').method('get').create(),
)

export const buildCommand = new commander.Command('build')
  .description(
    `Build environment defined by ${asLocalRelative(
      'e2b.Dockerfile',
    )} or ${asLocalRelative(
      'Dockerfile',
    )} in root directory. By default the root directory is the current working directory`,
  )
  .argument(
    '[id]',
    `Specify ${asBold('[id]')} of environment to rebuild it.If you don's specify ${asBold(
      '[id]',
    )} new environment will be created`,
  )
  .addOption(pathOption)
  .option(
    '-G, --no-gitignore',
    `Ignore ${asLocalRelative('.gitignore')} file in root directory`,
  )
  .option(
    '-d, --dockerfile <file>',
    `Specify path to Dockerfile.By default E2B tries to find ${asLocal(
      'e2b.Dockerfile',
    )} or ${asLocal('Dockerfile')} in root directory`,
  )
  .option(
    '-D, --no-dockerignore',
    `Ignore ${asLocalRelative('.dockerignore')} file in root directory`,
  )
  .alias('bd')
  .action(
    async (
      id: string | undefined,
      opts: {
        path?: string
        gitignore?: boolean
        dockerignore?: boolean
        dockerfile?: string
      },
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
          Note that.gitignore and.dockerignore files are respected by default when building the environment via from Dockerfile,
  use--no - gitignore and--no - dockerignore to override.
       `)
          return
        }

        console.log(
          `Preparing environment building (${filePaths.length} files in Docker build context).`,
        )

        const { dockerfileContent, dockerfileRelativePath } = getDockerfile(
          root,
          opts.dockerfile,
        )

        console.log(
          `Found ${asLocalRelative(
            dockerfileRelativePath,
          )} that will be used to build the environment.`,
        )

        const body = new FormData()

        body.append('dockerfile', dockerfileContent)

        if (id) {
          body.append('envID', id)
        }

        // It should be possible to pipe directly to the API
        // instead of creating a blob in memory then streaming.
        const blob = await createBlobFromFiles(
          root,
          filePaths,
          dockerfileRelativePath !== fallbackDockerfileName
            ? [{ oldPath: dockerfileRelativePath, newPath: fallbackDockerfileName }]
            : [],
        )
        body.append('buildContext', blob, 'env.tar.gz.e2b')

        const build = await buildEnv(accessToken, body)

        console.log(`Started building environment ${asFormattedEnvironment(build)} `)

        await waitForBuildFinish(accessToken, build.envID, build.buildID)
      } catch (err: any) {
        console.error(err)
        process.exit(1)
      }
    },
  )

async function waitForBuildFinish(accessToken: string, envID: string, buildID: string) {
  const startedAt = new Date()
  let logsOffset = 0

  function elapsed() {
    return Date.now() - startedAt.getTime()
  }

  let env: Awaited<ReturnType<typeof getEnv>> | undefined

  process.stdout.write('\n')
  do {
    await wait(envCheckInterval)
    env = await getEnv(accessToken, { envID, logsOffset, buildID })
    logsOffset += env.data.logs.length

    switch (env.data.status) {
      case 'building':
        env.data.logs.forEach(line => process.stdout.write(asBuildLogs(line)))
        break
      case 'ready':
        console.log(
          `✅ \n\nBuilding environment ${asFormattedEnvironment(env.data)} finished.`,
        )
        break

      case 'error':
        env.data.logs.forEach(line => process.stdout.write(asBuildLogs(line)))
        throw new Error(
          `\n\nBuilding environment ${asFormattedEnvironment(env.data)} failed.`,
        )
    }
  } while (env.data.status === 'building' && elapsed() < maxBuildTime)
}

function loadFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return undefined
  }

  return fs.readFileSync(filePath, 'utf-8')
}

function getDockerfile(root: string, file?: string) {
  // Check if user specified custom Dockerfile exists
  if (file) {
    const dockerfilePath = path.join(root, file)
    const dockerfileContent = loadFile(dockerfilePath)
    const dockerfileRelativePath = path.relative(root, dockerfilePath)

    if (dockerfileContent === undefined) {
      throw new Error(
        `No ${asLocalRelative(dockerfileRelativePath)} found in the root directory.`,
      )
    }

    return {
      dockerfilePath,
      dockerfileContent,
      dockerfileRelativePath,
    }
  }

  // Check if default dockerfile e2b.Dockerfile exists
  let dockerfilePath = path.join(root, defaultDockerfileName)
  let dockerfileContent = loadFile(dockerfilePath)
  const defaultDockerfileRelativePath = path.relative(root, dockerfilePath)
  let dockerfileRelativePath = defaultDockerfileRelativePath

  if (dockerfileContent !== undefined) {
    return {
      dockerfilePath,
      dockerfileContent,
      dockerfileRelativePath,
    }
  }

  // Check if fallback Dockerfile exists
  dockerfilePath = path.join(root, fallbackDockerfileName)
  dockerfileContent = loadFile(dockerfilePath)
  const fallbackDockerfileRelativeName = path.relative(root, dockerfilePath)
  dockerfileRelativePath = fallbackDockerfileRelativeName

  if (dockerfileContent !== undefined) {
    return {
      dockerfilePath,
      dockerfileContent,
      dockerfileRelativePath,
    }
  }

  throw new Error(
    `No ${asLocalRelative(defaultDockerfileRelativePath)} or ${asLocalRelative(
      fallbackDockerfileRelativeName,
    )} found in the root directory.You can specify a custom Dockerfile with ${asBold(
      '--dockerfile <file>',
    )} option.`,
  )
}

async function buildEnv(
  accessToken: string,
  body: FormData,
): Promise<
  Omit<
    e2b.paths['/envs']['post']['responses']['202']['content']['application/json'],
    'logs'
  >
> {
  const res = await fetch(`${e2b.API_HOST}/envs`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  })

  const data = await res.json()

  if (!res.ok) {
    const error:
      | e2b.paths['/envs']['post']['responses']['401']['content']['application/json']
      | e2b.paths['/envs']['post']['responses']['500']['content']['application/json'] =
      data as any

    if (error.code === 401) {
      throw new Error(
        `Authentication error: ${res.statusText}, ${error.message ?? 'no message'}`,
      )
    }

    if (error.code === 500) {
      throw new Error(`Server error: ${res.statusText}, ${error.message ?? 'no message'}`)
    }

    throw new Error(
      `API request failed: ${res.statusText}, ${error.message ?? 'no message'}`,
    )
  }

  return data as any
}