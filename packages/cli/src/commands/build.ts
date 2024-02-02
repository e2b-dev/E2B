import * as commander from 'commander'
import * as fs from 'fs'
import * as path from 'path'
import * as e2b from 'e2b'
import * as stripAnsi from 'strip-ansi'
import * as boxen from 'boxen'

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
  asPython,
  asTypescript,
  withDelimiter,
} from 'src/utils/format'
import { pathOption } from 'src/options'
import { createBlobFromFiles } from 'src/docker/archive'
import { defaultDockerfileName, fallbackDockerfileName } from 'src/docker/constants'
import { configName, getConfigPath, loadConfig, maxContentSize, saveConfig } from 'src/config'
import { estimateContentLength } from '../utils/form'

const templateCheckInterval = 1_000 // 1 sec

const getTemplate = e2b.withAccessToken(
  e2b.api.path('/templates/{templateID}/builds/{buildID}').method('get').create(),
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
    '[template]',
    `Specify ${asBold(
      '[template]',
    )} to rebuild it. If you don's specify ${asBold(
      '[template]',
    )} and there is no ${asLocal('e2b.toml')} a new sandbox template will be created`,
  )
  .addOption(pathOption)
  .option(
    '-d, --dockerfile <file>',
    `Specify path to Dockerfile. By default E2B tries to find ${asLocal(
      defaultDockerfileName,
    )} or ${asLocal(fallbackDockerfileName)} in root directory`,
  )
  .option(
    '-n, --name <template-name>',
    'Specify sandbox template name. You can use the template name to start the sandbox with SDK. The template name must be lowercase and contain only letters, numbers, dashes and underscores',
  )
  .option(
    '-c, --cmd <start-command>',
    'Specify command that will be executed when the sandbox is started',
  )
  .alias('bd')
  .action(
    async (
      templateID: string | undefined,
      opts: {
        path?: string;
        dockerfile?: string;
        name?: string;
        cmd?: string;
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

        let dockerfile = opts.dockerfile
        let startCmd = opts.cmd

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
                templateID: config.template_id,
                aliases: config.template_name ? [config.template_name] : undefined,
              },
              relativeConfigPath,
            )}`,
          )
          templateID = config.template_id
          dockerfile = opts.dockerfile || config.dockerfile
          startCmd = opts.cmd || config.start_cmd
        }

        if (config && templateID && config.template_id !== templateID) {
          // error: you can't specify different ID than the one in config
          console.error("You can't specify different ID than the one in config. If you want to build a new sandbox template remove the config file.")
          process.exit(1)
        }

        const filePaths = await getFiles(root, {
          respectGitignore: false,
          respectDockerignore: true,
          overrideIgnoreFor: [dockerfile || defaultDockerfileName],
        })

        if (newName && config?.template_name && newName !== config?.template_name) {
          console.log(
            `The sandbox template name will be changed from ${asLocal(config.template_name)} to ${asLocal(newName)}.`,
          )
        }
        const name = newName || config?.template_name

        console.log(
          `Preparing sandbox template building (${filePaths.length} files in Docker build context). ${!filePaths.length ? `If you are using ${asLocal('.dockerignore')} check if it is configured correctly.` : ''}`,
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
          maxContentSize,
        )
        body.append('buildContext', blob, 'env.tar.gz.e2b')

        if (name) {
          body.append('alias', name)
        }

        if (startCmd) {
          body.append('startCmd', startCmd)
        }

        const estimatedSize = estimateContentLength(body)
        if (estimatedSize > maxContentSize) {
          console.error(
            `The sandbox template build context is too large ${asLocal(`${Math.round(estimatedSize / 1024 / 1024 * 100) /100} MiB`)}. The maximum size is ${asLocal(
              `${maxContentSize / 1024 / 1024} MiB.`)}\n\nCheck if you are not including unnecessary files in the build context (e.g. node_modules)`,
          )
          process.exit(1)
        }

        const build = await buildTemplate(accessToken, body, !!config, configPath, templateID)

        console.log(
          `Started building the sandbox template ${asFormattedSandboxTemplate(
            build,
          )} `,
        )

        await waitForBuildFinish(accessToken, build.templateID, build.buildID, name)

        await saveConfig(
          configPath,
          {
            template_id: build.templateID,
            dockerfile: dockerfileRelativePath,
            template_name: name,
            start_cmd: startCmd,
          },
          true,
        )
      } catch (err: any) {
        console.error(err)
        process.exit(1)
      }
    },
  )

async function waitForBuildFinish(
  accessToken: string,
  templateID: string,
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
      template = await getTemplate(accessToken, { templateID, logsOffset, buildID })
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
      case 'ready': {

        const pythonExample = asPython(`from e2b import Sandbox

# Start sandbox
sandbox = Sandbox(template="${aliases?.length ? aliases[0] : template.data.templateID}")

# Interact with sandbox. Learn more here:
# https://e2b.dev/docs/sandbox/overview

# Close sandbox once done
sandbox.close()`)

        const typescriptExample = asTypescript(`import { Sandbox } from 'e2b'

// Start sandbox
const sandbox = await Sandbox.create({ template: '${aliases?.length ? aliases[0] : template.data.templateID}' })

// Interact with sandbox. Learn more here:
// https://e2b.dev/docs/sandbox/overview

// Close sandbox once done
await sandbox.close()`)


        const examplesMessage = `You can use E2B Python or JS SDK to spawn sandboxes now.
Find more here - ${asPrimary('https://e2b.dev/docs/guide/custom-sandbox')} in ${asBold('Spawn and control your sandbox')} section.`

        const exampleHeader = boxen.default(examplesMessage, {
          padding: {
            bottom: 1,
            top: 1,
            left: 2,
            right: 2,
          },
          margin: {
            top: 1,
            bottom: 1,
            left: 0,
            right: 0,
          },
          fullscreen(width) {
            return [width, 0]
          },
          float: 'left',
        })

        const exampleUsage = `${withDelimiter(pythonExample, 'Python SDK')}\n${withDelimiter(typescriptExample, 'JS SDK', true)}`

        console.log(
          `\n✅ Building sandbox template ${asFormattedSandboxTemplate(
            {
              aliases, ...template.data,
            },
          )} finished.\n${exampleHeader}\n${exampleUsage}\n`,
        )
        break
      }
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
  hasConfig: boolean,
  configPath: string,
  templateID?: string,
): Promise<
  Omit<
    e2b.paths['/templates']['post']['responses']['202']['content']['application/json'],
    'logs'
  >
> {
  const res = await fetch(e2b.API_HOST + (templateID ? `/templates/${templateID}` : '/templates'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
  })

  let data: any

  try {
    data = await res.json()
  } catch (e) {
    throw new Error(
      `Build API request failed: ${res.statusText}`,
    )
  }

  if (!res.ok) {
    const error:
      | e2b.paths['/templates']['post']['responses']['401']['content']['application/json']
      | e2b.paths['/templates']['post']['responses']['500']['content']['application/json'] =
      data as any

    if (error.code === 401) {
      throw new Error(
        `Authentication error: ${res.statusText}, ${error.message ?? 'no message'
        }`,
      )
    }

    if (error.code === 404) {
      throw new Error(
        `Sandbox template you want to build ${templateID ? `(${templateID})` : ''} not found: ${res.statusText}, ${error.message ?? 'no message'
        }\n${hasConfig ? `This could be caused by ${asLocalRelative(configPath)} belonging to a deleted template or a template that you don't own. If so you can delete the ${asLocalRelative(configPath)} and start building the template again.` : ''}`,
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
