import * as commander from 'commander'
import * as commonTags from 'common-tags'
import * as fs from 'fs'
import * as path from 'path'
import * as e2b from '@e2b/sdk'

import { wait } from 'src/utils/wait'
import { ensureAccessToken } from 'src/api'
import { getFiles, getRoot } from 'src/utils/filesystem'
import { asBold, asBuildLogs, asFormattedSandboxTemplate, asLocal, asLocalRelative, asPrimary } from 'src/utils/format'
import { pathOption } from 'src/options'
import { createBlobFromFiles } from 'src/docker/archive'
import { defaultDockerfileName, fallbackDockerfileName } from 'src/docker/constants'
import { configName, getConfigPath, loadConfig, saveConfig } from 'src/config'

const templateCheckInterval = 1_000 // 1 sec
const maxBuildTime = 10 * 60 * 1_000 // 10 min

const getTemplate = e2b.withAccessToken(
  e2b.api.path('/envs/{envID}/builds/{buildID}').method('get').create(),
)

export const buildCommand = new commander.Command('build')
  .description(
    `Build sandbox template defined by ${asLocalRelative(
      defaultDockerfileName,
    )} or ${asLocalRelative(
      fallbackDockerfileName,
    )} in root directory. By default the root directory is the current working directory. This command also creates ${asLocal(
      configName,
    )} config`,
  )
  .argument(
    '[id]',
    `Specify ${asBold(
      '[id]',
    )} of sandbox template to rebuild it. If you don's specify ${asBold(
      '[id]',
    )} and there is no ${asLocal('e2b.toml')} a new sandbox will be created`,
  )
  .addOption(pathOption)
  .option(
    '-d, --dockerfile <file>',
    `Specify path to Dockerfile. By default E2B tries to find ${asLocal(
      defaultDockerfileName,
    )} or ${asLocal(fallbackDockerfileName)} in root directory`,
  )
  .alias('bd')
  .action(
    async (
      id: string | undefined,
      opts: {
        path?: string;
        dockerfile?: string;
      },
    ) => {
      try {
        const accessToken = ensureAccessToken()
        process.stdout.write('\n')

        let envID = id
        let dockerfile = opts.dockerfile

        const root = getRoot(opts.path)
        const configPath = getConfigPath(root)

        const config = fs.existsSync(configPath)
          ? await loadConfig(configPath)
          : undefined

        const relativeConfigPath = path.relative(root, configPath)

        if (config) {
          console.log(
            `Found sandbox template ${asFormattedSandboxTemplate(
              {
                envID: config.id,
              },
              relativeConfigPath,
            )}`,
          )
          envID = config.id
          dockerfile = config.dockerfile
        }

        const filePaths = await getFiles(root, {
          respectGitignore: false,
          respectDockerignore: true,
        })

        if (!filePaths.length) {
          console.log(commonTags.stripIndent`
          No allowed files found in ${asLocalRelative(root)}. If you are using ${asLocal('.dockerignore')} check if it is configured correctly.
       `)
          return
        }

        console.log(
          `Preparing sandbox template building (${filePaths.length} files in Docker build context).`,
        )

        const { dockerfileContent, dockerfileRelativePath } = getDockerfile(
          root,
          dockerfile,
        )

        console.log(
          `Found ${asLocalRelative(
            dockerfileRelativePath,
          )} that will be used to build the sandbox template.`,
        )

        const body = new FormData()

        body.append('dockerfile', dockerfileContent)

        // It should be possible to pipe directly to the API
        // instead of creating a blob in memory then streaming.
        const blob = await createBlobFromFiles(
          root,
          filePaths,
          dockerfileRelativePath !== fallbackDockerfileName
            ? [
              {
                oldPath: dockerfileRelativePath,
                newPath: fallbackDockerfileName,
              },
            ]
            : [],
        )
        body.append('buildContext', blob, 'env.tar.gz.e2b')

        const build = await buildTemplate(accessToken, body, envID)

        console.log(
          `Started building the sandbox template ${asFormattedSandboxTemplate(
            build,
          )} `,
        )

        await waitForBuildFinish(accessToken, build.envID, build.buildID)

        if (!config) {
          await saveConfig(
            configPath,
            {
              id: build.envID,
              dockerfile: dockerfileRelativePath,
            },
            true,
          )
          console.log(`Created config ${asLocalRelative(relativeConfigPath)}`)
        }
      } catch (err: any) {
        console.error(err)
        process.exit(1)
      }
    },
  )

async function waitForBuildFinish(
  accessToken: string,
  envID: string,
  buildID: string,
) {
  const startedAt = new Date()
  let logsOffset = 0

  function elapsed() {
    return Date.now() - startedAt.getTime()
  }

  let template: Awaited<ReturnType<typeof getTemplate>> | undefined

  process.stdout.write('\n')
  do {
    await wait(templateCheckInterval)

    try {
      template = await getTemplate(accessToken, { envID, logsOffset, buildID })
    } catch (e) {
      if (e instanceof getTemplate.Error) {
        const error = e.getActualType()
        if (error.status === 401) {
          throw new Error(
            `Error getting build info - (${error.status}) bad request: ${error.data.message}`,
          )
        }
        if (error.status === 404) {
          throw new Error(
            `Error getting build info - (${error.status}) not found: ${error.data.message}`,
          )
        }
        if (error.status === 500) {
          throw new Error(
            `Error getting build info - (${error.status}) server error: ${error.data.message}`,
          )
        }
      }
      throw e
    }

    logsOffset += template.data.logs.length

    switch (template.data.status) {
      case 'building':
        template.data.logs.forEach((line) =>
          process.stdout.write(asBuildLogs(line)),
        )
        break
      case 'ready':
        console.log(
          `\n✅ Building sandbox template ${asFormattedSandboxTemplate(
            template.data,
          )} finished.\n`,
        )
        break

      case 'error':
        template.data.logs.forEach((line) =>
          process.stdout.write(asBuildLogs(line)),
        )
        throw new Error(
          `\n❌ Building sandbox template ${asFormattedSandboxTemplate(
            template.data,
          )} failed.\nCheck the logs above for more details or contact us ${asPrimary('(https://e2b.dev/docs/getting-help)')} to get help.\n`,
        )
    }
  } while (template.data.status === 'building' && elapsed() < maxBuildTime)
  // TODO: We do have another timeout for envs building in API so we probably should handle timeout only in one place
  if (template.data.status === 'building' && elapsed() >= maxBuildTime) {
    throw new Error(
      `\n❌ Building sandbox template ${asFormattedSandboxTemplate(
        template.data,
      )} timed out.\nCheck the logs above for more details or contact us ${asPrimary('(https://e2b.dev/docs/getting-help)')} to get help.\n`,
    )
  }
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
        `No ${asLocalRelative(
          dockerfileRelativePath,
        )} found in the root directory.`,
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

async function buildTemplate(
  accessToken: string,
  body: FormData,
  envID?: string,
): Promise<
  Omit<
    e2b.paths['/envs']['post']['responses']['202']['content']['application/json'],
    'logs'
  >
> {
  const res = await fetch(e2b.API_HOST + (envID ? `/envs/${envID}` : '/envs'), {
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
        `Authentication error: ${res.statusText}, ${error.message ?? 'no message'
        }`,
      )
    }

    if (error.code === 500) {
      throw new Error(
        `Server error: ${res.statusText}, ${error.message ?? 'no message'}`,
      )
    }

    throw new Error(
      `API request failed: ${res.statusText}, ${error.message ?? 'no message'}`,
    )
  }

  return data as any
}
