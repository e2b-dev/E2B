import { select } from '@inquirer/prompts'
import * as commander from 'commander'
import { Template, TemplateBuilder, TemplateClass } from 'e2b'
import * as fs from 'fs'
import * as path from 'path'
import { E2BConfig, getConfigPath, loadConfig } from 'src/config'
import { defaultDockerfileName } from 'src/docker/constants'
import { pathOption } from 'src/options'
import { getRoot } from 'src/utils/filesystem'
import { asLocal, asLocalRelative, asPrimary } from 'src/utils/format'
import { getDockerfile } from './build'
import {
  generateAndWriteTemplateFiles,
  Language,
  languageDisplay,
  validLanguages,
} from './generators'

/**
 * Migrate Dockerfile to a specific target language using SDK
 */
async function migrateToLanguage(
  root: string,
  config: E2BConfig,
  dockerfilePath: string,
  language: Language
): Promise<void> {
  // Initialize template with file context
  const template = Template({
    fileContextPath: root,
  })

  const { dockerfileContent } = getDockerfile(root, dockerfilePath)

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

  const alias = config.template_name || config.template_id
  if (!alias) {
    throw new Error('Template name or ID is required')
  }

  // Generate code for the target language using shared functionality
  await generateAndWriteTemplateFiles(
    root,
    alias,
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
  .option(
    '-c, --config <file>',
    `specify path to config file. Defaults to ${asLocal('e2b.toml')}`
  )
  .option(
    '-l, --language <language>',
    `specify target language: ${validLanguages.join(', ')}`,
    (value) => {
      if (!validLanguages.includes(value as Language)) {
        throw new Error(
          `Invalid language. Must be one of: ${validLanguages.join(', ')}`
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
    }) => {
      let success = false
      try {
        console.log('\n🔄 Migrating template configuration to SDK format...\n')

        const root = getRoot(opts.path)
        const configPath = getConfigPath(root, opts.config)

        // Validate config file exists
        if (!fs.existsSync(configPath)) {
          console.error(
            `Config file ${asLocalRelative(
              path.relative(root, configPath)
            )} not found. Please ensure the config file exists.`
          )
          process.exit(1)
        }

        const config = await loadConfig(configPath)

        // Determine Dockerfile path
        const dockerfilePath =
          opts.dockerfile || config.dockerfile || defaultDockerfileName

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
        await migrateToLanguage(root, config, dockerfilePath, language)

        console.log('\n🎉 Migration completed successfully!')
        console.log('\nYou can now build your template using:')
        if (language === Language.TypeScript) {
          console.log(
            `   ${asPrimary('npx tsx build.dev.ts')} (for development)`
          )
          console.log(
            `   ${asPrimary('npx tsx build.prod.ts')} (for production)`
          )
        } else {
          console.log(
            `   ${asPrimary('python build_dev.py')} (for development)`
          )
          console.log(
            `   ${asPrimary('python build_prod.py')} (for production)`
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
