import * as commander from 'commander'
import * as fs from 'fs'
import * as path from 'path'
import * as e2b from 'e2b'
import * as stripAnsi from 'strip-ansi'
import * as boxen from 'boxen'
import Docker from 'dockerode'
import { wait } from 'src/utils/wait'
import { ensureAccessToken } from 'src/api'
import { getRoot } from 'src/utils/filesystem'
import {
  asBold,
  asBuildLogs,
  asFormattedSandboxTemplate,
  asLocal,
  asLocalRelative,
  asPrimary,
  asPython,
  asTypescript,
  printDockerApiStream,
  withDelimiter,
} from 'src/utils/format'
import { configOption, pathOption, teamOption } from 'src/options'
import {
  defaultDockerfileName,
  fallbackDockerfileName,
} from 'src/docker/constants'
import { configName, getConfigPath, loadConfig, saveConfig } from 'src/config'
import * as child_process from 'child_process'

import { client } from 'src/api'

const templateCheckInterval = 500 // 0.5 sec

const getTemplate = e2b.withAccessToken(
  client.api
    .path('/templates/{templateID}/builds/{buildID}/status')
    .method('get')
    .create(),
)

const requestTemplateBuild = e2b.withAccessToken(
  client.api.path('/templates').method('post').create(),
)

const requestTemplateRebuild = e2b.withAccessToken(
  client.api.path('/templates/{templateID}').method('post').create(),
)

const triggerTemplateBuild = e2b.withAccessToken(
  client.api
    .path('/templates/{templateID}/builds/{buildID}')
    .method('post')
    .create(),
)

export const buildCommand = new commander.Command('build')
  .description(
    `build sandbox template defined by ${asLocalRelative(
      defaultDockerfileName,
    )} or ${asLocalRelative(
      fallbackDockerfileName,
    )} in root directory. By default the root directory is the current working directory. This command also creates ${asLocal(
      configName,
    )} config.`,
  )
  .argument(
    '[template]',
    `specify ${asBold(
      '[template]',
    )} to rebuild it. If you don's specify ${asBold(
      '[template]',
    )} and there is no ${asLocal(
      'e2b.toml',
    )} a new sandbox template will be created.`,
  )
  .addOption(pathOption)
  .option(
    '-d, --dockerfile <file>',
    `specify path to Dockerfile. By default E2B tries to find ${asLocal(
      defaultDockerfileName,
    )} or ${asLocal(fallbackDockerfileName)} in root directory.`,
  )
  .option(
    '-n, --name <template-name>',
    'specify sandbox template name. You can use the template name to start the sandbox with SDK. The template name must be lowercase and contain only letters, numbers, dashes and underscores.',
  )
  .option(
    '-c, --cmd <start-command>',
    'specify command that will be executed when the sandbox is started.',
  )
  .addOption(teamOption)
  .addOption(configOption)
  .option(
    '--cpu-count <cpu-count>',
    'specify the number of CPUs that will be used to run the sandbox. The default value is 2.',
    parseInt,
  )
  .option(
    '--memory-mb <memory-mb>',
    'specify the amount of memory in megabytes that will be used to run the sandbox. Must be an even number. The default value is 512.',
    parseInt,
  )
  .option(
    '--build-arg <args...>',
    'specify additional build arguments for the build command. The format should be <varname>=<value>.',
  )
  .alias('bd')
  .action(
    async (
      templateID: string | undefined,
      opts: {
        path?: string
        dockerfile?: string
        name?: string
        cmd?: string
        team?: string
        config?: string
        cpuCount?: number
        memoryMb?: number
        buildArg?: [string]
      },
    ) => {
      try {
        const docker = new Docker()
        try {
          await docker.ping()
        } catch {
          console.error(
            'Docker is required to build and push the sandbox template. Please install Docker and try again.',
          )
          process.exit(1)
        }

        const dockerBuildArgs: { [key: string]: string } = {}
        if (opts.buildArg) {
          opts.buildArg.forEach((arg) => {
            const [key, value] = arg.split('=')
            dockerBuildArgs[key] = value
          })
        }

        const accessToken = ensureAccessToken()
        process.stdout.write('\n')

        const newName = opts.name?.trim()
        if (newName && !/[a-z0-9-_]+/.test(newName)) {
          console.error(
            `Name ${asLocal(
              newName,
            )} is not valid. Name can only contain lowercase letters, numbers, dashes and underscores.`,
          )
          process.exit(1)
        }

        let dockerfile = opts.dockerfile
        let startCmd = opts.cmd
        let cpuCount = opts.cpuCount
        let memoryMB = opts.memoryMb
        let teamID = opts.team

        const root = getRoot(opts.path)
        const configPath = getConfigPath(root, opts.config)

        const config = fs.existsSync(configPath)
          ? await loadConfig(configPath)
          : undefined

        const relativeConfigPath = path.relative(root, configPath)

        if (config) {
          console.log(
            `Found sandbox template ${asFormattedSandboxTemplate(
              {
                templateID: config.template_id,
                aliases: config.template_name
                  ? [config.template_name]
                  : undefined,
              },
              relativeConfigPath,
            )}`,
          )
          templateID = config.template_id
          dockerfile = opts.dockerfile || config.dockerfile
          startCmd = opts.cmd || config.start_cmd
          cpuCount = opts.cpuCount || config.cpu_count
          memoryMB = opts.memoryMb || config.memory_mb
          teamID = opts.team || config.team_id
        }

        if (config && templateID && config.template_id !== templateID) {
          // error: you can't specify different ID than the one in config
          console.error(
            "You can't specify different ID than the one in config. If you want to build a new sandbox template remove the config file.",
          )
          process.exit(1)
        }

        if (
          newName &&
          config?.template_name &&
          newName !== config?.template_name
        ) {
          console.log(
            `The sandbox template name will be changed from ${asLocal(
              config.template_name,
            )} to ${asLocal(newName)}.`,
          )
        }
        const name = newName || config?.template_name

        const { dockerfileContent, dockerfileRelativePath } = getDockerfile(
          root,
          dockerfile,
        )

        console.log(
          `Found ${asLocalRelative(
            dockerfileRelativePath,
          )} that will be used to build the sandbox template.`,
        )

        const body = {
          alias: name,
          startCmd: startCmd,
          cpuCount: cpuCount,
          memoryMB: memoryMB,
          dockerfile: dockerfileContent,
          teamID: teamID,
        }

        if (opts.memoryMb) {
          if (opts.memoryMb % 2 !== 0) {
            console.error(
              `The memory in megabytes must be an even number. You provided ${asLocal(
                opts.memoryMb.toFixed(0),
              )}.`,
            )
            process.exit(1)
          }
        }

        const template = await requestBuildTemplate(
          accessToken,
          body,
          !!config,
          relativeConfigPath,
          templateID,
        )
        templateID = template.templateID

        console.log(
          `Requested build for the sandbox template ${asFormattedSandboxTemplate(
            template,
          )} `,
        )

        await saveConfig(
          configPath,
          {
            template_id: template.templateID,
            dockerfile: dockerfileRelativePath,
            template_name: name,
            start_cmd: startCmd,
            cpu_count: cpuCount,
            memory_mb: memoryMB,
            team_id: teamID,
          },
          true,
        )

        try {
          docker.checkAuth({
            username: '_e2b_access_token',
            password: accessToken,
            serveraddress: `docker.${e2b.SANDBOX_DOMAIN}`,
          })
        } catch (err: any) {
          console.error(
            'Docker login failed. Please try to log in with `e2b auth login` and try again.',
          )
          process.exit(1)
        }
        process.stdout.write('\n')

        console.log('Building docker image...')
        const dockerImageTag = `docker.${e2b.SANDBOX_DOMAIN}/e2b/custom-envs/${templateID}:${template.buildID}`
        const buildImageStream = await docker.buildImage({
          context: root,
          src: fs.readdirSync(root),
        }, {
          t: dockerImageTag,
          platform: 'linux/amd64',
          buildargs: dockerBuildArgs,
          dockerfile: dockerfileRelativePath,
          pull: 'true',
        })
        for await (const chunk of buildImageStream) {
          printDockerApiStream(chunk.toString());
        }
        console.log('Docker image built.\n')

        console.log('Pushing docker image...')
        const dockerImage = docker.getImage(dockerImageTag)
        const pushImageStream = await dockerImage.push({
          authconfig: {
            username: '_e2b_access_token',
            password: accessToken,
            serveraddress: `docker.${e2b.SANDBOX_DOMAIN}`,
          },
        })
        for await (const chunk of pushImageStream) {
          printDockerApiStream(chunk.toString());
        }
        console.log('Docker image pushed.\n')

        console.log('Triggering build...')
        await triggerBuild(accessToken, templateID, template.buildID)

        console.log(
          `Triggered build for the sandbox template ${asFormattedSandboxTemplate(
            template,
          )} `,
        )

        console.log('Waiting for build to finish...')
        await waitForBuildFinish(
          accessToken,
          templateID,
          template.buildID,
          name,
        )

        process.exit(0)
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
      template = await getTemplate(accessToken, {
        templateID,
        logsOffset,
        buildID,
      })
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
sandbox = Sandbox(template="${aliases?.length ? aliases[0] : template.data.templateID
          }")

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
Find more here - ${asPrimary(
          'https://e2b.dev/docs/guide/custom-sandbox',
        )} in ${asBold('Spawn and control your sandbox')} section.`

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

        const exampleUsage = `${withDelimiter(
          pythonExample,
          'Python SDK',
        )}\n${withDelimiter(typescriptExample, 'JS SDK', true)}`

        console.log(
          `\n✅ Building sandbox template ${asFormattedSandboxTemplate({
            aliases,
            ...template.data,
          })} finished.\n${exampleHeader}\n${exampleUsage}\n`,
        )
        break
      }
      case 'error':
        template.data.logs.forEach((line) =>
          process.stdout.write(asBuildLogs(stripAnsi.default(line))),
        )
        throw new Error(
          `\n❌ Building sandbox template ${asFormattedSandboxTemplate({
            aliases,
            ...template.data,
          })} failed.\nCheck the logs above for more details or contact us ${asPrimary(
            '(https://e2b.dev/docs/getting-help)',
          )} to get help.\n`,
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
    )} found in the root directory (${root}). You can specify a custom Dockerfile with ${asBold(
      '--dockerfile <file>',
    )} option.`,
  )
}

async function requestBuildTemplate(
  accessToken: string,
  args: e2b.paths['/templates']['post']['requestBody']['content']['application/json'],
  hasConfig: boolean,
  configPath: string,
  templateID?: string,
): Promise<
  Omit<
    e2b.paths['/templates']['post']['responses']['202']['content']['application/json'],
    'logs'
  >
> {
  let res
  if (templateID) {
    res = await requestTemplateRebuild(accessToken, { templateID, ...args })
  } else {
    res = await requestTemplateBuild(accessToken, args)
  }

  if (!res.ok) {
    const error:
      | e2b.paths['/templates']['post']['responses']['401']['content']['application/json']
      | e2b.paths['/templates']['post']['responses']['500']['content']['application/json'] =
      res.data as any

    if (error.code === 401) {
      throw new Error(
        `Authentication error: ${res.statusText}, ${error.message ?? 'no message'
        }`,
      )
    }

    if (error.code === 404) {
      throw new Error(
        `Sandbox template you want to build ${templateID ? `(${templateID})` : ''
        } not found: ${res.statusText}, ${error.message ?? 'no message'}\n${hasConfig
          ? `This could be caused by ${asLocalRelative(
            configPath,
          )} belonging to a deleted template or a template that you don't own. If so you can delete the ${asLocalRelative(
            configPath,
          )} and start building the template again.`
          : ''
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

  return res.data as any
}

async function triggerBuild(
  accessToken: string,
  templateID: string,
  buildID: string,
) {
  const res = await triggerTemplateBuild(accessToken, { templateID, buildID })

  if (!res.ok) {
    const error:
      | e2b.paths['/templates/{templateID}/builds/{buildID}']['post']['responses']['401']['content']['application/json']
      | e2b.paths['/templates/{templateID}/builds/{buildID}']['post']['responses']['500']['content']['application/json'] =
      res.data as any

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

  return
}
