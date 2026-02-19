import * as boxen from 'boxen'
import * as commander from 'commander'
import { defaultBuildLogger, Template, TemplateClass } from 'e2b'
import { connectionConfig, ensureAccessToken, ensureAPIKey } from 'src/api'
import {
  defaultDockerfileName,
  fallbackDockerfileName,
} from 'src/docker/constants'
import { pathOption } from 'src/options'
import { getRoot } from 'src/utils/filesystem'
import {
  asFormattedSandboxTemplate,
  asLocal,
  asLocalRelative,
  asPrimary,
  asPython,
  asTypescript,
  withDelimiter,
} from '../../utils/format'
import { getDockerfile } from './build'

export const createCommand = new commander.Command('create')
  .description(
    'build Dockerfile as a Sandbox template. This command reads a Dockerfile and builds it directly.'
  )
  .argument(
    '<template-name>',
    'template name to create or rebuild. The template name must be lowercase and contain only letters, numbers, dashes and underscores.'
  )
  .addOption(pathOption)
  .option(
    '-d, --dockerfile <file>',
    `specify path to Dockerfile. By default E2B tries to find ${asLocal(
      defaultDockerfileName
    )} or ${asLocal(fallbackDockerfileName)} in root directory.`
  )
  .option(
    '-c, --cmd <start-command>',
    'specify command that will be executed when the sandbox is started.'
  )
  .option(
    '--ready-cmd <ready-command>',
    'specify command that will need to exit 0 for the template to be ready.'
  )
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
  .option('--no-cache', 'skip cache when building the template.')
  .alias('ct')
  .action(
    async (
      templateName: string,
      opts: {
        path?: string
        dockerfile?: string
        cmd?: string
        readyCmd?: string
        cpuCount?: number
        memoryMb?: number
        noCache?: boolean
      }
    ) => {
      try {
        // Ensure we have access token
        ensureAccessToken()
        process.stdout.write('\n')

        // Validate template name
        if (!/^[a-z0-9-_]+$/.test(templateName)) {
          console.error(
            `Template name ${asLocal(
              templateName
            )} is not valid. Template name can only contain lowercase letters, numbers, dashes and underscores.`
          )
          process.exit(1)
        }

        // Validate memory
        if (opts.memoryMb && opts.memoryMb % 2 !== 0) {
          console.error(
            `The memory in megabytes must be an even number. You provided ${asLocal(
              opts.memoryMb.toFixed(0)
            )}.`
          )
          process.exit(1)
        }

        const root = getRoot(opts.path)

        // Use options directly
        const dockerfile = opts.dockerfile
        const startCmd = opts.cmd
        const readyCmd = opts.readyCmd
        const cpuCount = opts.cpuCount
        const memoryMB = opts.memoryMb

        // Get Dockerfile content
        const { dockerfileContent, dockerfileRelativePath } = getDockerfile(
          root,
          dockerfile
        )

        console.log(
          `Found ${asLocalRelative(
            dockerfileRelativePath
          )} that will be used to build the sandbox template.`
        )

        // Initialize template builder with file context and parse Dockerfile
        const baseTemplate = Template({
          fileContextPath: root,
        }).fromDockerfile(dockerfileContent)

        // Apply start/ready commands if provided
        let finalTemplate: TemplateClass = baseTemplate
        if (startCmd && readyCmd) {
          finalTemplate = baseTemplate.setStartCmd(startCmd, readyCmd)
        } else if (readyCmd) {
          finalTemplate = baseTemplate.setReadyCmd(readyCmd)
        } else if (startCmd) {
          console.error('Both start and ready commands must be provided.')
          process.exit(1)
        }

        console.log('\nBuilding sandbox template...\n')

        // Prepare API credentials for SDK
        const apiKey = ensureAPIKey()
        const domain = connectionConfig.domain

        // Build the template using SDK
        try {
          await Template.build(finalTemplate, {
            alias: templateName,
            cpuCount: cpuCount,
            memoryMB: memoryMB,
            skipCache: opts.noCache,
            apiKey: apiKey,
            domain: domain,
            onBuildLogs: defaultBuildLogger(),
          })
        } catch (error) {
          console.error('\n❌ Template build failed.')
          if (error instanceof Error) {
            console.error('Error:', error.message)
          }
          process.exit(1)
        }

        // Display success message with examples
        const pythonExample = asPython(`from e2b import Sandbox, AsyncSandbox

# Create sync sandbox
sandbox = Sandbox.create("${templateName}")

# Create async sandbox
sandbox = await AsyncSandbox.create("${templateName}")`)

        const typescriptExample = asTypescript(`import { Sandbox } from 'e2b'

// Create sandbox
const sandbox = await Sandbox.create('${templateName}')`)

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
            templateID: templateName,
          })} finished.\n${exampleHeader}\n${exampleUsage}\n`
        )

        process.exit(0)
      } catch (err: any) {
        console.error(err)
        process.exit(1)
      }
    }
  )
