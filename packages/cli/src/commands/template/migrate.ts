import { select } from '@inquirer/prompts'
import * as commander from 'commander'
import { Template, TemplateBuilder, TemplateClass } from 'e2b'
import * as fs from 'fs'
import * as path from 'path'
import {
  defaultDockerfileName,
  fallbackDockerfileName,
} from '../../docker/constants'
import {
  deprecatedConfigOption,
  parsePositiveInt,
  warnIgnoredConfigOption,
} from '../../options'
import { getRoot } from '../../utils/filesystem'
import { asBold, asLocal, asLocalRelative, asPrimary } from '../../utils/format'
import { getDockerfile } from './dockerfile'
import { validateTemplateName } from '../../utils/templateName'
import {
  generateAndWriteTemplateFiles,
  Language,
  languageDisplay,
  parseLanguage,
} from './generators'

const defaultTemplateName = 'name-your-template'

const deprecatedPathOption = new commander.Option(
  '-p, --path <path>',
  `[deprecated] run the command from ${asBold('<path>')} instead`
).hideHelp()

interface MigrateOverrides {
  name?: string
  startCmd?: string
  readyCmd?: string
  cpuCount?: number
  memoryMb?: number
}

/**
 * Migrate Dockerfile to a specific target language using SDK
 */
async function migrateToLanguage(
  root: string,
  dockerfileContent: string,
  language: Language,
  overrides: MigrateOverrides
): Promise<void> {
  // Initialize template with file context
  const template = Template({
    fileContextPath: root,
  })

  // Parse Dockerfile using SDK
  let baseTemplate: TemplateBuilder
  try {
    baseTemplate = template.fromDockerfile(dockerfileContent)
  } catch (error) {
    console.warn(
      "\n⚠️  Unfortunately, we weren't able to fully convert the template to the new SDK format."
    )
    console.warn(
      '\nPlease build the Docker image manually, push it to a repository of your choice, and then reference it.'
    )
    console.warn("\nHere's an example of how to build the Docker image:")
    console.warn(
      `   ${asPrimary(
        'docker build -f e2b.Dockerfile --platform linux/amd64 -t your-image-tag .'
      )}`
    )
    console.warn(
      '\nAfter building and pushing your image to a repository of your choice, update the generated template files to use the actual image tag.'
    )
    if (error instanceof Error) {
      console.warn('\nCause:', error.message)
    }
    baseTemplate = template.fromImage('my-custom-image')
  }

  let parsedTemplate: TemplateClass = baseTemplate
  if (overrides.startCmd) {
    parsedTemplate = baseTemplate.setStartCmd(
      overrides.startCmd,
      overrides.readyCmd || 'sleep 20'
    )
  } else if (overrides.readyCmd) {
    parsedTemplate = baseTemplate.setReadyCmd(overrides.readyCmd)
  }

  await generateAndWriteTemplateFiles(
    root,
    overrides.name ?? defaultTemplateName,
    language,
    parsedTemplate,
    overrides.cpuCount,
    overrides.memoryMb
  )
}

export const migrateCommand = new commander.Command('migrate')
  .description('migrate a Dockerfile to the Template SDK format')
  .option(
    '-d, --dockerfile <file>',
    `specify path to Dockerfile. By default E2B tries to find ${asLocal(
      defaultDockerfileName
    )} or ${asLocal(fallbackDockerfileName)} in the current directory.`
  )
  .addOption(deprecatedConfigOption)
  .option(
    '-n, --name <name>',
    `specify the template name used in the generated files. Defaults to ${asLocal(
      defaultTemplateName
    )}.`,
    (value) => {
      try {
        return validateTemplateName(value)
      } catch (err) {
        throw new commander.InvalidArgumentError(
          err instanceof Error ? err.message : String(err)
        )
      }
    }
  )
  .option(
    '-c, --cmd <start-command>',
    'specify the command that will be executed when the sandbox is started.'
  )
  .option(
    '--ready-cmd <ready-command>',
    'specify the command that will need to exit 0 for the template to be ready.'
  )
  .option(
    '--cpu-count <cpu-count>',
    'specify the number of CPUs that will be used to run the sandbox.',
    parsePositiveInt('CPU count')
  )
  .option(
    '--memory-mb <memory-mb>',
    'specify the amount of memory in megabytes that will be used to run the sandbox. Must be an even number.',
    parsePositiveInt('Memory in megabytes')
  )
  .option(
    '-l, --language <language>',
    `specify target language: ${Object.values(Language).join(', ')}`,
    parseLanguage
  )
  .addOption(deprecatedPathOption)
  .action(
    async (opts: {
      dockerfile?: string
      config?: string
      path?: string
      language?: Language
      name?: string
      cmd?: string
      readyCmd?: string
      cpuCount?: number
      memoryMb?: number
    }) => {
      let success = false
      try {
        warnIgnoredConfigOption(
          opts,
          `Use ${asBold('--name')}, ${asBold('--cmd')}, ${asBold(
            '--ready-cmd'
          )}, ${asBold('--cpu-count')} and ${asBold('--memory-mb')} instead.`
        )
        if (opts.path) {
          console.error(
            `The ${asBold('--path')} flag is deprecated, run the command from the template directory instead.`
          )
        }

        console.log('\n🔄 Migrating Dockerfile to SDK format...\n')

        // Validate memory override
        if (opts.memoryMb && opts.memoryMb % 2 !== 0) {
          throw new Error(
            `The memory in megabytes must be an even number. You provided ${asLocal(
              opts.memoryMb.toFixed(0)
            )}.`
          )
        }

        const root = getRoot(opts.path)
        const { dockerfileContent, dockerfilePath, dockerfileRelativePath } =
          getDockerfile(root, opts.dockerfile)

        // Determine target language
        let language: Language
        if (opts.language) {
          language = opts.language
          console.log(`Using language: ${asPrimary(languageDisplay[language])}`)
        } else {
          // Prompt for language selection
          language = await select({
            message: 'Select target language for Template SDK:',
            choices: [
              {
                name: languageDisplay[Language.TypeScript],
                value: Language.TypeScript,
                description:
                  'Generate .ts files for JavaScript/TypeScript projects',
              },
              {
                name: languageDisplay[Language.PythonSync],
                value: Language.PythonSync,
                description: 'Generate synchronous Python template files',
              },
              {
                name: languageDisplay[Language.PythonAsync],
                value: Language.PythonAsync,
                description: 'Generate asynchronous Python template files',
              },
            ],
            default: Language.TypeScript,
          })
        }

        // Perform migration
        await migrateToLanguage(root, dockerfileContent, language, {
          name: opts.name,
          startCmd: opts.cmd,
          readyCmd: opts.readyCmd,
          cpuCount: opts.cpuCount,
          memoryMb: opts.memoryMb,
        })

        // Rename old files to .old extensions
        const oldFilesRenamed: { oldPath: string; newPath: string }[] = []

        // Rename Dockerfile if it exists
        if (fs.existsSync(dockerfilePath)) {
          const oldDockerfilePath = `${dockerfilePath}.old`
          fs.renameSync(dockerfilePath, oldDockerfilePath)
          oldFilesRenamed.push({
            oldPath: dockerfileRelativePath,
            newPath: path.relative(root, oldDockerfilePath),
          })
        }

        if (oldFilesRenamed.length > 0) {
          console.log('\n📁 Old template files no longer needed:')
          oldFilesRenamed.forEach((file) => {
            console.log(
              `   ${asLocalRelative(file.oldPath)} → ${asLocalRelative(file.newPath)}`
            )
          })
        }

        console.log('\n🎉 Migration completed successfully!')

        console.log('\n🔨 To get started with your template:')
        if (language === Language.TypeScript) {
          console.log(
            `   ${asPrimary('npm install e2b')} (install e2b dependency)`
          )
          console.log(
            `   ${asPrimary('npx tsx build.dev.ts')} (run development build)`
          )
          console.log(
            `   ${asPrimary('npx tsx build.prod.ts')} (run production build)`
          )
        } else {
          console.log(
            `   ${asPrimary('pip install e2b')} (install e2b dependency)`
          )
          console.log(
            `   ${asPrimary('python build_dev.py')} (run development build)`
          )
          console.log(
            `   ${asPrimary('python build_prod.py')} (run production build)`
          )
        }

        console.log(
          `\nLearn more about Template SDK: ${asPrimary(
            'https://e2b.dev/docs'
          )}\n`
        )
        success = true
      } catch (err: any) {
        console.error(`Migration failed: ${err.message}`)
        process.exit(1)
      }

      if (success) {
        process.exit(0)
      }
    }
  )
