import * as commander from 'commander'
import * as commonTags from 'common-tags'
import * as fs from 'fs'
import * as path from 'path'
import * as e2b from '@e2b/sdk'
import * as stripAnsi from 'strip-ansi'

import { wait } from 'src/utils/wait'
import { ensureAccessToken } from 'src/api'
import { getFiles, getRoot } from 'src/utils/filesystem'
import {
  asBold,
  asBuildLogs,
  asFormattedSandboxTemplate,
  asLocal,
  asLocalRelative,
  asPrimary,
} from 'src/utils/format'
import { pathOption } from 'src/options'
import { createBlobFromFiles } from 'src/docker/archive'
import { defaultDockerfileName, fallbackDockerfileName } from 'src/docker/constants'
import { configName, getConfigPath, loadConfig, saveConfig } from 'src/config'

const templateCheckInterval = 1_000 // 1 sec

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
  .option(
    '-n, --name <name>',
    'Specify name of sandbox template. You can use the name to start the sandbox in the SDK. The name must be lowercase and contain only letters, numbers, dashes and underscores.',
  )
  .alias('bd')
  .action(
    async (
      id: string | undefined,
      opts: {
        path?: string;
        dockerfile?: string;
        name?: string;
      },
    ) => {
      try {
        const accessToken = ensureAccessToken()
        process.stdout.write('\n')

        const newName = opts.name?.trim()
        if (newName && !/[a-z0-9-_]+/.test(newName)) {
          console.error(
            `Name ${asLocal(newName)} is not valid. Name can only contain lowercase letters, numbers, dashes and underscores.`,
          )
          process.exit(1)
        }

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
                aliases: config.name ? [config.name] : undefined,
              },
              relativeConfigPath,
            )}`,
          )
          envID = config.id
          dockerfile = config.dockerfile
        }

        if (config && id && config.id !== id) {
          // error: you can't specify different ID than the one in config
          console.error("You can't specify different ID than the one in config. If you want to build a new sandbox template remove the config file.")
          process.exit(1)
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

        if (newName && config?.name && newName !== config?.name) {
          console.log(
            `The name of the sandbox will be changed from ${asLocal(config.name)} to ${asLocal(newName)}.`,
          )
        }
        const name = newName || config?.name

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

        if (name) {
          body.append('alias', name)
        }

        const build = await buildTemplate(accessToken, body, envID)

        console.log(
          `Started building the sandbox template ${asFormattedSandboxTemplate(
            build,
          )} `,
        )

        await waitForBuildFinish(accessToken, build.envID, build.buildID, name)

        await saveConfig(
          configPath,
          {
            id: build.envID,
            dockerfile: dockerfileRelativePath,
            name: name,
          },
          true,
        )
        console.log(`Created config ${asLocalRelative(relativeConfigPath)}`)
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
  name?: string,
) {
  let logsOffset = 0

  let template: Awaited<ReturnType<typeof getTemplate>> | undefined
  const aliases = name ? [name] : undefined

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
          process.stdout.write(asBuildLogs(stripAnsi.default(line))),
        )
        break
      case 'ready':
        console.log(
          `\n✅ Building sandbox template ${asFormattedSandboxTemplate(
            { aliases, ...template.data },
          )} finished.\n
          Now you can start creating your sandboxes from this template. You can find more here: 
          ${asPrimary('https://e2b.dev/docs/guide/custom-sandbox')}, section ${asBold('Spawn and control your sandbox')}\n`,
        )
        break

      case 'error':
        template.data.logs.forEach((line) =>
          process.stdout.write(asBuildLogs(stripAnsi.default(line))),
        )
        throw new Error(
          `\n❌ Building sandbox template ${asFormattedSandboxTemplate(
            { aliases, ...template.data },
          )} failed.\nCheck the logs above for more details or contact us ${asPrimary('(https://e2b.dev/docs/getting-help)')} to get help.\n`,
        )
    }
  } while (template.data.status === 'building')
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
