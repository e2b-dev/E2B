import { select } from '@inquirer/prompts'
import * as commander from 'commander'
import { Template, TemplateBuilder, TemplateClass } from 'e2b'
import * as fs from 'fs'
import Handlebars from 'handlebars'
import * as path from 'path'
import { E2BConfig, getConfigPath, loadConfig } from 'src/config'
import { defaultDockerfileName } from 'src/docker/constants'
import { pathOption } from 'src/options'
import { getRoot } from 'src/utils/filesystem'
import { asLocal, asLocalRelative, asPrimary } from 'src/utils/format'
import { getDockerfile } from './build'

enum Language {
  TypeScript = 'typescript',
  PythonSync = 'python-sync',
  PythonAsync = 'python-async',
}

const validLanguages: Language[] = [
  Language.TypeScript,
  Language.PythonSync,
  Language.PythonAsync,
]

const languageDisplay = {
  [Language.TypeScript]: 'TypeScript',
  [Language.PythonSync]: 'Python (sync)',
  [Language.PythonAsync]: 'Python (async)',
}

interface TemplateJSON {
  fromImage?: string
  fromTemplate?: string
  startCmd?: string
  readyCmd?: string
  force: boolean
  steps: Array<{
    type: string
    args: string[]
    filesHash?: string
    force?: boolean
  }>
}

// Register Handlebars helpers
Handlebars.registerHelper('eq', function (a: any, b: any, options: any) {
  if (a === b) {
    // @ts-ignore - this context is provided by Handlebars
    return options.fn(this)
  }
  return ''
})

Handlebars.registerHelper('escapeQuotes', function (str) {
  return str ? str.replace(/'/g, "\\'") : str
})

Handlebars.registerHelper('escapeDoubleQuotes', function (str) {
  return str ? str.replace(/"/g, '\\"') : str
})

// Transform template JSON data for Handlebars
function transformTemplateData(json: TemplateJSON) {
  const transformedSteps: any[] = []

  for (const step of json.steps) {
    switch (step.type) {
      case 'ENV': {
        // Keep all environment variables from one ENV instruction together
        const envVars: Record<string, string> = {}
        for (let i = 0; i < step.args.length; i += 2) {
          if (i + 1 < step.args.length) {
            envVars[step.args[i]] = step.args[i + 1]
          }
        }
        transformedSteps.push({
          type: 'ENV',
          envVars,
        })
        break
      }
      case 'COPY': {
        if (step.args.length >= 2) {
          const src = step.args[0]
          let dest = step.args[step.args.length - 1]
          if (!dest || dest === '') {
            dest = '.'
          }
          transformedSteps.push({
            type: 'COPY',
            src,
            dest,
          })
        }
        break
      }
      default:
        transformedSteps.push({
          type: step.type,
          args: step.args,
        })
    }
  }

  return {
    ...json,
    steps: transformedSteps,
  }
}

/**
 * Convert the JSON representation from Template.toJSON() to TypeScript code
 */
function jsonToTypeScript(
  json: TemplateJSON,
  alias: string,
  cpuCount?: number,
  memoryMB?: number
): { templateContent: string; buildContent: string } {
  const transformedData = transformTemplateData(json)

  // Load and compile templates
  // When running from dist/index.js, templates are in dist/templates/
  const templatesDir = path.join(__dirname, 'templates')
  const templateSource = fs.readFileSync(
    path.join(templatesDir, 'typescript-template.hbs'),
    'utf8'
  )
  const buildSource = fs.readFileSync(
    path.join(templatesDir, 'typescript-build.hbs'),
    'utf8'
  )

  const templateTemplate = Handlebars.compile(templateSource)
  const buildTemplate = Handlebars.compile(buildSource)

  // Generate content
  const templateData = {
    ...transformedData,
  }

  const templateContent = templateTemplate(templateData)

  const buildContent = buildTemplate({
    alias,
    cpuCount,
    memoryMB,
  })

  return {
    templateContent: templateContent.trim(),
    buildContent: buildContent.trim(),
  }
}

/**
 * Convert the JSON representation from Template.toJSON() to Python code
 */
function jsonToPython(
  json: TemplateJSON,
  alias: string,
  cpuCount?: number,
  memoryMB?: number,
  isAsync: boolean = false
): { templateContent: string; buildContent: string } {
  const transformedData = transformTemplateData(json)

  // Load and compile templates
  // When running from dist/index.js, templates are in dist/templates/
  const templatesDir = path.join(__dirname, 'templates')
  const templateSource = fs.readFileSync(
    path.join(templatesDir, 'python-template.hbs'),
    'utf8'
  )
  const buildSource = fs.readFileSync(
    path.join(templatesDir, `python-build-${isAsync ? 'async' : 'sync'}.hbs`),
    'utf8'
  )

  const templateTemplate = Handlebars.compile(templateSource)
  const buildTemplate = Handlebars.compile(buildSource)

  // Generate content
  const templateContent = templateTemplate({
    ...transformedData,
    isAsync,
  })

  const buildContent = buildTemplate({
    alias,
    cpuCount,
    memoryMB,
  })

  return {
    templateContent: templateContent.trim(),
    buildContent: buildContent.trim(),
  }
}

/**
 * Generate unique file names to avoid overwriting existing files
 */
function getUniqueFileName(
  directory: string,
  baseName: string,
  extension: string
): string {
  let fileName = `${baseName}${extension}`
  let counter = 1

  while (fs.existsSync(path.join(directory, fileName))) {
    fileName = `${baseName}-${counter}${extension}`
    counter++
  }

  return fileName
}

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

  // Extract JSON structure from parsed template
  const jsonString = await Template.toJSON(parsedTemplate, false)
  const json = JSON.parse(jsonString) as TemplateJSON

  const alias = config.template_name || config.template_id
  if (!alias) {
    throw new Error('Template name or ID is required')
  }

  // Generate code for the target language
  if (language === Language.TypeScript) {
    const { templateContent, buildContent: buildDevContent } = jsonToTypeScript(
      json,
      `${alias}-dev`,
      config.cpu_count,
      config.memory_mb
    )
    const { buildContent: buildProdContent } = jsonToTypeScript(
      json,
      alias,
      config.cpu_count,
      config.memory_mb
    )

    const extension = '.ts'
    const templateFile = getUniqueFileName(root, 'template', extension)
    const buildDevFile = getUniqueFileName(root, 'build.dev', extension)
    const buildProdFile = getUniqueFileName(root, 'build.prod', extension)

    await fs.promises.writeFile(path.join(root, templateFile), templateContent)
    await fs.promises.writeFile(path.join(root, buildDevFile), buildDevContent)
    await fs.promises.writeFile(
      path.join(root, buildProdFile),
      buildProdContent
    )

    console.log(
      `\n✅ Generated ${asPrimary(
        languageDisplay[Language.TypeScript]
      )} template files:`
    )
    console.log(`   ${asLocalRelative(templateFile)}`)
    console.log(`   ${asLocalRelative(buildDevFile)}`)
    console.log(`   ${asLocalRelative(buildProdFile)}`)
  } else {
    const isAsync = language === Language.PythonAsync
    const { templateContent, buildContent: buildDevContent } = jsonToPython(
      json,
      `${alias}-dev`,
      config.cpu_count,
      config.memory_mb,
      isAsync
    )
    const { buildContent: buildProdContent } = jsonToPython(
      json,
      alias,
      config.cpu_count,
      config.memory_mb,
      isAsync
    )

    const extension = '.py'
    const templateFile = getUniqueFileName(root, 'template', extension)
    const buildDevFile = getUniqueFileName(root, 'build_dev', extension)
    const buildProdFile = getUniqueFileName(root, 'build_prod', extension)

    await fs.promises.writeFile(path.join(root, templateFile), templateContent)
    await fs.promises.writeFile(path.join(root, buildDevFile), buildDevContent)
    await fs.promises.writeFile(
      path.join(root, buildProdFile),
      buildProdContent
    )

    console.log(
      `\n✅ Generated ${asPrimary(languageDisplay[language])} template files:`
    )
    console.log(`   ${asLocalRelative(templateFile)}`)
    console.log(`   ${asLocalRelative(buildDevFile)}`)
    console.log(`   ${asLocalRelative(buildProdFile)}`)
  }
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
