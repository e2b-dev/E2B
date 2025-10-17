import * as boxen from 'boxen'
import * as child_process from 'child_process'
import commandExists from 'command-exists'
import * as commander from 'commander'
import * as e2b from 'e2b'
import * as fs from 'fs'
import * as path from 'path'
import { client, connectionConfig, ensureAccessToken } from 'src/api'
import { configName, getConfigPath, loadConfig, saveConfig } from 'src/config'
import {
  defaultDockerfileName,
  fallbackDockerfileName,
} from 'src/docker/constants'
import { configOption, pathOption, teamOption } from 'src/options'
import { getUserConfig } from 'src/user'
import { getRoot } from 'src/utils/filesystem'
import { wait } from 'src/utils/wait'
import * as stripAnsi from 'strip-ansi'
import { handleE2BRequestError } from '../../utils/errors'
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
} from '../../utils/format'
import { buildWithProxy } from './buildWithProxy'

const templateCheckInterval = 500 // 0.5 sec

// Custom image URI is used for Bring Your Own Compute with self-hosted Docker registry
export const imageUriMask = process.env.E2B_IMAGE_URI_MASK

async function getTemplateBuildLogs({
  templateID,
  buildID,
  logsOffset,
}: {
  templateID: string
  buildID: string
  logsOffset: number
}) {
  const signal = connectionConfig.getSignal()
  const res = await client.api.GET(
    '/templates/{templateID}/builds/{buildID}/status',
    {
      signal,
      params: {
        path: {
          templateID,
          buildID,
        },
        query: {
          logsOffset,
        },
      },
    }
  )

  handleE2BRequestError(res, 'Error getting template build status')
  return res.data as e2b.paths['/templates/{templateID}/builds/{buildID}/status']['get']['responses']['200']['content']['application/json']
}

async function requestTemplateBuild(
  args: e2b.paths['/templates']['post']['requestBody']['content']['application/json']
) {
  return await client.api.POST('/templates', {
    body: args,
  })
}

async function requestTemplateRebuild(
  templateID: string,
  args: e2b.paths['/templates/{templateID}']['post']['requestBody']['content']['application/json']
) {
  return await client.api.POST('/templates/{templateID}', {
    body: args,
    params: {
      path: {
        templateID,
      },
    },
  })
}

async function triggerTemplateBuild(templateID: string, buildID: string) {
  let res
  const maxRetries = 3
  for (let i = 0; i < maxRetries; i++) {
    try {
      res = await client.api.POST('/templates/{templateID}/builds/{buildID}', {
        params: {
          path: {
            templateID,
            buildID,
          },
        },
      })

      break
    } catch (e) {
      // If the build and push takes more than 10 minutes the connection gets automatically closed by load balancer
      // and the request fails with UND_ERR_SOCKET error. In this case we just need to retry the request.
      if (
        e instanceof TypeError &&
        ((e as TypeError).cause as any)?.code !== 'UND_ERR_SOCKET'
      ) {
        console.error(e)
        console.log('Retrying...')
      }
    }
  }

  if (!res) {
    throw new Error('Error triggering template build')
  }

  handleE2BRequestError(res, 'Error triggering template build')
  return res.data
}

export const buildCommand = new commander.Command('build')
  .description(
    `build sandbox template defined by ${asLocalRelative(
      defaultDockerfileName
    )} or ${asLocalRelative(
      fallbackDockerfileName
    )} in root directory. By default the root directory is the current working directory. This command also creates ${asLocal(
      configName
    )} config.`
  )
  .argument(
    '[template]',
    `specify ${asBold(
      '[template]'
    )} to rebuild it. If you dont's specify ${asBold(
      '[template]'
    )} and there is no ${asLocal(
      'e2b.toml'
    )} a new sandbox template will be created.`
  )
  .addOption(pathOption)
  .option(
    '-d, --dockerfile <file>',
    `specify path to Dockerfile. By default E2B tries to find ${asLocal(
      defaultDockerfileName
    )} or ${asLocal(fallbackDockerfileName)} in root directory.`
  )
  .option(
    '-n, --name <template-name>',
    'specify sandbox template name. You can use the template name to start the sandbox with SDK. The template name must be lowercase and contain only letters, numbers, dashes and underscores.'
  )
  .option(
    '-c, --cmd <start-command>',
    'specify command that will be executed when the sandbox is started.'
  )
  .option(
    '--ready-cmd <ready-command>',
    'specify command that will need to exit 0 for the template to be ready.'
  )
  .addOption(teamOption)
  .addOption(configOption)
  .option(
    '--cpu-count <cpu-count>',
    'specify the number of CPUs that will be used to run the sandbox. The default value is 2.',
    parseInt
  )
  .option(
    '--memory-mb <memory-mb>',
    'specify the amount of memory in megabytes that will be used to run the sandbox. Must be an even number. The default value is 512.',
    parseInt
  )
  .option(
    '--build-arg <args...>',
    'specify additional build arguments for the build command. The format should be <varname>=<value>.'
  )
  .option('--no-cache', 'skip cache when building the template.')
  .alias('bd')
  .action(
    async (
      templateID: string | undefined,
      opts: {
        path?: string
        dockerfile?: string
        name?: string
        cmd?: string
        readyCmd?: string
        team?: string
        config?: string
        cpuCount?: number
        memoryMb?: number
        buildArg?: [string]
        noCache?: boolean
      }
    ) => {
      try {
        // Display deprecation warning
        const deprecationMessage = `${asBold('DEPRECATION WARNING')}

This is the v1 build system which is now deprecated.
Please migrate to the new build system v2.

Migration guide: ${asPrimary('https://e2b.dev/docs/template/migration-v2')}`

        const deprecationWarning = boxen.default(deprecationMessage, {
          padding: {
            bottom: 0,
            top: 0,
            left: 2,
            right: 2,
          },
          margin: {
            top: 1,
            bottom: 1,
            left: 0,
            right: 0,
          },
          borderColor: 'yellow',
          borderStyle: 'round',
        })

        console.log(deprecationWarning)

        const dockerInstalled = commandExists.sync('docker')
        if (!dockerInstalled) {
          console.error(
            'Docker is required to build and push the sandbox template. Please install Docker and try again.'
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
              newName
            )} is not valid. Name can only contain lowercase letters, numbers, dashes and underscores.`
          )
          process.exit(1)
        }

        let dockerfile = opts.dockerfile
        let startCmd = opts.cmd
        let readyCmd = opts.readyCmd
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
              relativeConfigPath
            )}`
          )
          templateID = config.template_id
          dockerfile = opts.dockerfile || config.dockerfile
          startCmd = opts.cmd || config.start_cmd
          readyCmd = opts.readyCmd || config.ready_cmd
          cpuCount = opts.cpuCount || config.cpu_count
          memoryMB = opts.memoryMb || config.memory_mb
          teamID = opts.team || config.team_id
        }

        const userConfig = getUserConfig()
        if (userConfig) {
          teamID = teamID || userConfig.teamId
        }

        if (config && templateID && config.template_id !== templateID) {
          // error: you can't specify different ID than the one in config
          console.error(
            "You can't specify different ID than the one in config. If you want to build a new sandbox template remove the config file."
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
              config.template_name
            )} to ${asLocal(newName)}.`
          )
        }
        const name = newName || config?.template_name

        const { dockerfileContent, dockerfileRelativePath } = getDockerfile(
          root,
          dockerfile
        )

        console.log(
          `Found ${asLocalRelative(
            dockerfileRelativePath
          )} that will be used to build the sandbox template.`
        )

        const body = {
          alias: name,
          startCmd: startCmd,
          readyCmd: readyCmd,
          cpuCount: cpuCount,
          memoryMB: memoryMB,
          dockerfile: dockerfileContent,
          teamID: teamID,
        }

        if (opts.memoryMb) {
          if (opts.memoryMb % 2 !== 0) {
            console.error(
              `The memory in megabytes must be an even number. You provided ${asLocal(
                opts.memoryMb.toFixed(0)
              )}.`
            )
            process.exit(1)
          }
        }

        const template = await requestBuildTemplate(body, templateID)
        templateID = template.templateID

        console.log(
          `Requested build for the sandbox template ${asFormattedSandboxTemplate(
            template
          )} `
        )

        await saveConfig(
          configPath,
          {
            template_id: template.templateID,
            dockerfile: dockerfileRelativePath,
            template_name: name,
            start_cmd: startCmd,
            ready_cmd: readyCmd,
            cpu_count: cpuCount,
            memory_mb: memoryMB,
            team_id: teamID,
          },
          true
        )

        if (imageUriMask == undefined) {
          try {
            child_process.execSync(
              `echo "${accessToken}" | docker login docker.${connectionConfig.domain} -u _e2b_access_token --password-stdin`,
              {
                stdio: 'inherit',
                cwd: root,
              }
            )
          } catch (err: any) {
            console.error(
              'Docker login failed. Please try to log in with `e2b auth login` and try again.'
            )
            process.exit(1)
          }
        }

        process.stdout.write('\n')

        const buildArgs = Object.entries(dockerBuildArgs)
          .map(([key, value]) => `--build-arg "${key}=${value}"`)
          .join(' ')

        const noCache = opts.noCache ? '--no-cache' : ''

        const imageUrl = dockerImageUrl(
          templateID,
          template.buildID,
          connectionConfig.domain,
          imageUriMask
        )
        if (imageUriMask != undefined) {
          console.log('Using custom docker image URI:', imageUrl)
        }

        const cmd = [
          'docker build',
          `-f ${dockerfileRelativePath}`,
          '--pull --platform linux/amd64',
          `-t ${imageUrl}`,
          buildArgs,
          noCache,
          '.',
        ].join(' ')

        console.log(
          `Building docker image with the following command:\n${asBold(cmd)}\n`
        )

        child_process.execSync(cmd, {
          stdio: 'inherit',
          cwd: root,
          env: {
            ...process.env,
            DOCKER_CLI_HINTS: 'false',
          },
        })
        console.log('> Docker image built.\n')

        const pushCmd = `docker push ${imageUrl}`
        console.log(
          `Pushing docker image with the following command:\n${asBold(
            pushCmd
          )}\n`
        )
        try {
          child_process.execSync(pushCmd, {
            stdio: 'inherit',
            cwd: root,
          })
        } catch (err: any) {
          await buildWithProxy(
            userConfig,
            connectionConfig,
            accessToken,
            template,
            root
          )
        }
        console.log('> Docker image pushed.\n')

        console.log('Triggering build...')
        await triggerBuild(templateID, template.buildID)

        console.log(
          `> Triggered build for the sandbox template ${asFormattedSandboxTemplate(
            template
          )} with build ID: ${template.buildID}`
        )

        console.log('Waiting for build to finish...')
        await waitForBuildFinish(templateID, template.buildID, name)

        process.exit(0)
      } catch (err: any) {
        console.error(err)
        process.exit(1)
      }
    }
  )

async function waitForBuildFinish(
  templateID: string,
  buildID: string,
  name?: string
) {
  let logsOffset = 0

  let template: Awaited<ReturnType<typeof getTemplateBuildLogs>> | undefined
  const aliases = name ? [name] : undefined

  process.stdout.write('\n')
  do {
    await wait(templateCheckInterval)

    template = await getTemplateBuildLogs({
      templateID,
      logsOffset,
      buildID,
    })

    logsOffset += template.logs.length

    template.logs.forEach((line) =>
      process.stdout.write(asBuildLogs(stripAnsi.default(line)))
    )

    switch (template.status) {
      case 'building':
        break
      case 'ready': {
        const pythonExample = asPython(`from e2b import Sandbox, AsyncSandbox

# Create sync sandbox
sandbox = Sandbox.create("${
          aliases?.length ? aliases[0] : template.templateID
        }")

# Create async sandbox
sandbox = await AsyncSandbox.create("${
          aliases?.length ? aliases[0] : template.templateID
        }")`)

        const typescriptExample = asTypescript(`import { Sandbox } from 'e2b'

// Create sandbox
const sandbox = await Sandbox.create('${
          aliases?.length ? aliases[0] : template.templateID
        }')`)

        const examplesMessage = `You can now use the template to create custom sandboxes.\nLearn more on ${asPrimary(
          'https://e2b.dev/docs'
        )}`

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
          'Python SDK'
        )}\n${withDelimiter(typescriptExample, 'JS SDK', true)}`

        console.log(
          `\n✅ Building sandbox template ${asFormattedSandboxTemplate({
            aliases,
            ...template,
          })} finished.\n${exampleHeader}\n${exampleUsage}\n`
        )
        break
      }
      case 'error':
        throw new Error(
          `\n❌ Building sandbox template ${asFormattedSandboxTemplate({
            aliases,
            ...template,
          })} failed.\nCheck the logs above for more details or contact us ${asPrimary(
            '(https://e2b.dev/docs/support)'
          )} to get help.\n`
        )
    }
  } while (template.status === 'building')
}

function loadFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return undefined
  }

  return fs.readFileSync(filePath, 'utf-8')
}

export function getDockerfile(root: string, file?: string) {
  // Check if user specified custom Dockerfile exists
  if (file) {
    const dockerfilePath = path.join(root, file)
    const dockerfileContent = loadFile(dockerfilePath)
    const dockerfileRelativePath = path.relative(root, dockerfilePath)

    if (dockerfileContent === undefined) {
      throw new Error(
        `No ${asLocalRelative(
          dockerfileRelativePath
        )} found in the root directory.`
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
      fallbackDockerfileRelativeName
    )} found in the root directory (${root}). You can specify a custom Dockerfile with ${asBold(
      '--dockerfile <file>'
    )} option.`
  )
}

async function requestBuildTemplate(
  args: e2b.paths['/templates']['post']['requestBody']['content']['application/json'],
  templateID?: string
): Promise<
  Omit<
    e2b.paths['/templates']['post']['responses']['202']['content']['application/json'],
    'logs'
  >
> {
  let res
  if (templateID) {
    res = await requestTemplateRebuild(templateID, args)
  } else {
    res = await requestTemplateBuild(args)
  }

  handleE2BRequestError(res, 'Error requesting template build')
  return res.data
}

async function triggerBuild(templateID: string, buildID: string) {
  await triggerTemplateBuild(templateID, buildID)

  return
}

function dockerImageUrl(
  templateID: string,
  buildID: string,
  defaultDomain: string,
  imageUrlMask?: string
): string {
  if (imageUrlMask == undefined) {
    return `docker.${defaultDomain}/e2b/custom-envs/${templateID}:${buildID}`
  }

  return imageUrlMask
    .replaceAll('{templateID}', templateID)
    .replaceAll('{buildID}', buildID)
}
