import { select } from '@inquirer/prompts'
import * as commander from 'commander'
import { Template, TemplateBuilder, TemplateClass } from 'e2b'
import * as fs from 'fs'
import * as path from 'path'
import { E2BConfig, getConfigPath, loadConfig } from '../../config'
import { defaultDockerfileName } from '../../docker/constants'
import { configOption, parsePositiveInt, pathOption } from '../../options'
import { getRoot } from '../../utils/filesystem'
import { asLocal, asLocalRelative, asPrimary } from '../../utils/format'
import { getDockerfile } from './dockerfile'
import { validateTemplateName } from '../../utils/templateName'
import {
  generateAndWriteTemplateFiles,
  Language,
  languageDisplay,
} from './generators'
import { listSandboxTemplates } from './list'
import { resolveTeamId } from '../../api'

/**
 * Resolve the human-readable template alias used as `Template.build(..., name)`.
 *
 * `template_id` is an opaque internal ID. Passing it as `name` makes the API
 * try to register that string as a *new* alias, which collides with the
 * existing template → 409 (#1478). Prefer `template_name`, then the first
 * alias returned by the templates API for this ID, and only fall back to
 * `template_id` with a loud warning when nothing else is available.
 */
async function resolveMigrateBuildName(
  config: E2BConfig,
  nameOverride?: string
): Promise<string> {
  if (nameOverride) {
    return nameOverride
  }
  if (config.template_name) {
    return config.template_name
  }
  if (!config.template_id) {
    throw new Error('Template name or ID is required')
  }

  try {
    const templates = await listSandboxTemplates({
      teamID: resolveTeamId(undefined, config.team_id),
    })
    const match = templates.find((tpl) => tpl.templateID === config.template_id)
    const alias = match?.aliases?.find((a) => typeof a === 'string' && a.length > 0)
    if (alias) {
      console.log(
        `Resolved template_id ${asLocal(config.template_id)} to alias ${asPrimary(alias)}`
      )
      return alias
    }
  } catch (err) {
    console.warn(
      `Could not list templates to resolve alias for ${asLocal(config.template_id)}: ${
        err instanceof Error ? err.message : String(err)
      }`
    )
  }

  console.warn(
    `\n⚠️  No template_name/alias found for template_id ${asLocal(
      config.template_id
    )}. Using the ID as the build name may cause a 409 alias collision.`
  )
  console.warn(
    `   Prefer: e2b template migrate --name <existing-alias>  (or set template_name in e2b.toml)\n`
  )
  return config.template_id
}

/**
 * Migrate Dockerfile to a specific target language using SDK
 */
async function migrateToLanguage(
  root: string,
  config: E2BConfig,
  dockerfileContent: string,
  language: Language,
  nameOverride?: string
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

  // Apply config start/ready commands
  let parsedTemplate: TemplateClass = baseTemplate
  if (config.start_cmd) {
    parsedTemplate = baseTemplate.setStartCmd(
      config.start_cmd,
      config.ready_cmd || 'sleep 20'
    )
  } else if (config.ready_cmd) {
    parsedTemplate = baseTemplate.setReadyCmd(config.ready_cmd)
  }

  const name = await resolveMigrateBuildName(config, nameOverride)

  // Generate code for the target language using shared functionality
  await generateAndWriteTemplateFiles(
    root,
    name,
    language,
    parsedTemplate,
    config.cpu_count,
    config.memory_mb
  )
}

export const migrateCommand = new commander.Command('migrate')
  .description(
    `migrate ${asLocal('e2b.Dockerfile')} and ${asLocal(
      'e2b.toml'
    )} to new Template SDK format`
  )
  .option(
    '-d, --dockerfile <file>',
    `specify path to Dockerfile. Defaults to ${asLocal('e2b.Dockerfile')}`
  )
  .addOption(configOption)
  .option(
    '-n, --name <name>',
    'override the template name used in the generated files. Defaults to the template name or ID from the config file.',
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
    'override the command that will be executed when the sandbox is started.'
  )
  .option(
    '--ready-cmd <ready-command>',
    'override the command that will need to exit 0 for the template to be ready.'
  )
  .option(
    '--cpu-count <cpu-count>',
    'override the number of CPUs that will be used to run the sandbox.',
    parsePositiveInt('CPU count')
  )
  .option(
    '--memory-mb <memory-mb>',
    'override the amount of memory in megabytes that will be used to run the sandbox. Must be an even number.',
    parsePositiveInt('Memory in megabytes')
  )
  .option(
    '-l, --language <language>',
    `specify target language: ${Object.values(Language).join(', ')}`,
    (value) => {
      if (!Object.values(Language).includes(value as Language)) {
        throw new commander.InvalidArgumentError(
          `Invalid language. Must be one of: ${Object.values(Language).join(
            ', '
          )}`
        )
      }
      return value as Language
    }
  )
  .addOption(pathOption)
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
        console.log('\n🔄 Migrating template configuration to SDK format...\n')

        // Validate memory override
        if (opts.memoryMb && opts.memoryMb % 2 !== 0) {
          throw new Error(
            `The memory in megabytes must be an even number. You provided ${asLocal(
              opts.memoryMb.toFixed(0)
            )}.`
          )
        }

        const root = getRoot(opts.path)
        const configPath = getConfigPath(root, opts.config)

        const { dockerfileContent, dockerfilePath, dockerfileRelativePath } =
          getDockerfile(root, opts.dockerfile)

        let config: E2BConfig = {
          template_id: 'name-your-template',
          dockerfile: defaultDockerfileName,
        }

        // Validate config file exists
        if (fs.existsSync(configPath)) {
          config = await loadConfig(configPath)
        } else {
          console.error(
            `Config file ${asLocalRelative(
              path.relative(root, configPath)
            )} not found. Using defaults.`
          )
        }

        // Apply command-line overrides on top of the loaded config
        if (opts.cmd !== undefined) {
          config.start_cmd = opts.cmd
        }
        if (opts.readyCmd !== undefined) {
          config.ready_cmd = opts.readyCmd
        }
        if (opts.cpuCount !== undefined) {
          config.cpu_count = opts.cpuCount
        }
        if (opts.memoryMb !== undefined) {
          config.memory_mb = opts.memoryMb
        }

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
        await migrateToLanguage(
          root,
          config,
          dockerfileContent,
          language,
          opts.name
        )

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

        // Rename e2b.toml if it exists
        if (fs.existsSync(configPath)) {
          const oldConfigPath = `${configPath}.old`
          fs.renameSync(configPath, oldConfigPath)
          oldFilesRenamed.push({
            oldPath: path.relative(root, configPath),
            newPath: path.relative(root, oldConfigPath),
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
