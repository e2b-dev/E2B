import * as commander from 'commander'
import * as fs from 'fs'
import * as path from 'path'
import * as e2b from 'e2b'
import * as stripAnsi from 'strip-ansi'
import * as boxen from 'boxen'
import commandExists from 'command-exists'
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
  withDelimiter,
} from 'src/utils/format'
import { configOption, pathOption, teamOption } from 'src/options'
import {
  defaultDockerfileName,
  fallbackDockerfileName,
} from 'src/docker/constants'
import {
  dockerConnect,
  dockerBuild,
  pushDockerImage,
} from 'src/docker/commands'
import { configName, getConfigPath, loadConfig, saveConfig } from 'src/config'

import { client } from 'src/api'
import { requestBuildTemplate, triggerBuild } from './utils'

const templateCheckInterval = 500 // 0.5 sec

const getTemplate = e2b.withAccessToken(
  client.api
    .path('/templates/{templateID}/builds/{buildID}/status')
    .method('get')
    .create()
)
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
    )} to rebuild it. If you don's specify ${asBold(
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
  .alias('bd')
  .action(
    async (
      templateID: string | undefined,
      opts: {
        path?: string;
        dockerfile?: string;
        name?: string;
        cmd?: string;
        team?: string;
        config?: string;
        cpuCount?: number;
        memoryMb?: number;
        buildArg?: [string];
      }
    ) => {
      try {
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
          cpuCount = opts.cpuCount || config.cpu_count
          memoryMB = opts.memoryMb || config.memory_mb
          teamID = opts.team || config.team_id
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

        const template = await requestBuildTemplate(
          accessToken,
          body,
          !!config,
          relativeConfigPath,
          templateID
        )
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
            cpu_count: cpuCount,
            memory_mb: memoryMB,
            team_id: teamID,
          },
          true
        )

        dockerConnect(accessToken, root)

        dockerBuild(
          dockerfileRelativePath,
          templateID,
          template,
          dockerBuildArgs,
          root
        )

        pushDockerImage(templateID, template, root)

        console.log('Triggering build...')
        await triggerBuild(accessToken, templateID, template.buildID)

        console.log(
          `Triggered build for the sandbox template ${asFormattedSandboxTemplate(
            template
          )} `
        )

        console.log('Waiting for build to finish...')
        await waitForBuildFinish(
          accessToken,
          templateID,
          template.buildID,
          name
        )

        process.exit(0)
      } catch (err: any) {
        console.error(err)
        process.exit(1)
      }
    }
  )

async function waitForBuildFinish(
  accessToken: string,
  templateID: string,
  buildID: string,
  name?: string
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
            `Error getting build info - (${error.status}) bad request: ${error.data.message}`
          )
        }
        if (error.status === 404) {
          throw new Error(
            `Error getting build info - (${error.status}) not found: ${error.data.message}`
          )
        }
        if (error.status === 500) {
          throw new Error(
            `Error getting build info - (${error.status}) server error: ${error.data.message}`
          )
        }
      }
      throw e
    }

    logsOffset += template.data.logs.length

    switch (template.data.status) {
      case 'building':
        template.data.logs.forEach((line) =>
          process.stdout.write(asBuildLogs(stripAnsi.default(line)))
        )
        break
      case 'ready': {
        const pythonExample = asPython(`from e2b import Sandbox

# Start sandbox
sandbox = Sandbox(template="${
          aliases?.length ? aliases[0] : template.data.templateID
        }")

# Interact with sandbox. Learn more here:
# https://e2b.dev/docs/sandbox/overview

# Close sandbox once done
sandbox.close()`)

        const typescriptExample = asTypescript(`import { Sandbox } from 'e2b'

// Start sandbox
const sandbox = await Sandbox.create({ template: '${
          aliases?.length ? aliases[0] : template.data.templateID
        }' })

// Interact with sandbox. Learn more here:
// https://e2b.dev/docs/sandbox/overview

// Close sandbox once done
await sandbox.close()`)

        const examplesMessage = `You can use E2B Python or JS SDK to spawn sandboxes now.
Find more here - ${asPrimary(
          'https://e2b.dev/docs/guide/custom-sandbox'
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
          'Python SDK'
        )}\n${withDelimiter(typescriptExample, 'JS SDK', true)}`

        console.log(
          `\n✅ Building sandbox template ${asFormattedSandboxTemplate({
            aliases,
            ...template.data,
          })} finished.\n${exampleHeader}\n${exampleUsage}\n`
        )
        break
      }
      case 'error':
        template.data.logs.forEach((line) =>
          process.stdout.write(asBuildLogs(stripAnsi.default(line)))
        )
        throw new Error(
          `\n❌ Building sandbox template ${asFormattedSandboxTemplate({
            aliases,
            ...template.data,
          })} failed.\nCheck the logs above for more details or contact us ${asPrimary(
            '(https://e2b.dev/docs/getting-help)'
          )} to get help.\n`
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
