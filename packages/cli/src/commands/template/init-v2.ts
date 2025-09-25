import { input, select } from '@inquirer/prompts'
import PackageJson from '@npmcli/package-json'
import * as commander from 'commander'
import { Template } from 'e2b'
import * as fs from 'fs'
import * as path from 'path'
import { pathOption } from 'src/options'
import { getRoot } from 'src/utils/filesystem'
import { asPrimary } from 'src/utils/format'
import {
  generateAndWriteTemplateFiles,
  GeneratedFiles,
  Language,
  languageDisplay,
} from './generators'
import { generateReadmeContent } from './generators/handlebars'

const DEFAULT_TEMPLATE_NAME = 'my-template'

/**
 * Generate template files using shared template generation logic
 */
async function generateTemplateFiles(
  root: string,
  alias: string,
  language: Language,
  cpuCount?: number,
  memoryMB?: number
): Promise<GeneratedFiles> {
  const template = Template().fromBaseImage().runCmd('echo Hello World E2B!')

  return generateAndWriteTemplateFiles(
    root,
    alias,
    language,
    template,
    cpuCount,
    memoryMB
  )
}

/**
 * Add build scripts to package.json if it exists
 */
async function addPackageJsonScripts(
  root: string,
  files: GeneratedFiles,
  templateDirName?: string
): Promise<void> {
  try {
    // Use @npmcli/package-json for robust handling
    // The library expects the directory path, not the full file path
    const pkgJson = await PackageJson.load(root, {
      create: true,
    })

    // Generate script commands based on language and directory structure
    const cdPrefix = templateDirName ? `cd ${templateDirName} && ` : ''

    switch (files.language) {
      case Language.TypeScript:
        pkgJson.update({
          scripts: {
            ...pkgJson.content.scripts,
            'e2b:build:dev': `${cdPrefix}npx tsx ${files.buildDevFile}`,
            'e2b:build:prod': `${cdPrefix}npx tsx ${files.buildProdFile}`,
          },
        })
        break
      case Language.PythonAsync:
      case Language.PythonSync:
        pkgJson.update({
          scripts: {
            ...pkgJson.content.scripts,
            'e2b:build:dev': `${cdPrefix}python ${files.buildDevFile}`,
            'e2b:build:prod': `${cdPrefix}python ${files.buildProdFile}`,
          },
        })
        break
      default:
        throw new Error('Unsupported language for package.json scripts')
    }

    // Save the changes
    await pkgJson.save()

    console.log('\n📝 Added build scripts to package.json:')
    console.log(
      `   ${asPrimary('npm run e2b:build:dev')} - Build development template`
    )
    console.log(
      `   ${asPrimary('npm run e2b:build:prod')} - Build production template`
    )
  } catch (err) {
    console.warn(
      '\n⚠️  Could not add scripts to package.json:',
      err instanceof Error ? err.message : err
    )
  }
}

/**
 * Check template name format
 */
function templateNameRegex(name: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*[a-z0-9]$|^[a-z0-9]$/.test(name)
}

function validateTemplateName(name: string) {
  if (!name || name.trim().length === 0) {
    throw new Error('Template name cannot be empty')
  }
  if (!templateNameRegex(name.trim())) {
    throw new Error(
      'Template name must contain only lowercase letters, numbers, hyphens, and underscores, and cannot start or end with a hyphen or underscore'
    )
  }
}

export const initV2Command = new commander.Command('init-v2')
  .description('initialize a new sandbox template using the SDK')
  .addOption(pathOption)
  .option('-n, --name <name>', 'template name (alias)', (value) => {
    try {
      validateTemplateName(value)
    } catch (err) {
      throw new commander.InvalidArgumentError(
        err instanceof Error ? err.message : String(err)
      )
    }

    return value
  })
  .option(
    '-l, --language <language>',
    `target language: ${Object.values(Language).join(', ')}`,
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
  .alias('it-v2')
  .alias('create')
  .action(
    async (opts: { path?: string; name?: string; language?: Language }) => {
      try {
        process.stdout.write('\n')

        const root = getRoot(opts.path)

        console.log('🚀 Initializing Sandbox Template...\n')

        // Step 1: Get template name (from CLI or prompt)
        let templateName: string = opts.name ?? DEFAULT_TEMPLATE_NAME
        if (opts.name === undefined) {
          templateName = await input({
            message: 'Enter template name (alias):',
            default: DEFAULT_TEMPLATE_NAME,
            validate: (input: string) => {
              try {
                validateTemplateName(input)
              } catch (err) {
                return err instanceof Error ? err.message : err
              }

              return true
            },
          })
        }
        templateName = templateName.trim()
        console.log(`Using template name: ${templateName}`)

        // Step 2: Get language (from CLI or prompt)
        let language: Language
        if (opts.language) {
          language = opts.language
          console.log(`Using language: ${languageDisplay[language]}`)
        } else {
          language = await select({
            message: 'Select target language for template files:',
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

        // Step 3: Create template directory - fail if it already exists
        const templateDirName = templateName
        const templateDir = path.join(root, templateDirName)

        if (fs.existsSync(templateDir)) {
          throw new Error(
            `Directory '${templateDirName}' already exists. Please choose a different template name or remove the existing directory.`
          )
        }

        await fs.promises.mkdir(templateDir, { recursive: true })

        // Step 4: Generate template and build files in the template directory
        const generatedFiles = await generateTemplateFiles(
          templateDir,
          templateName,
          language
        )

        // Step 5: Add scripts to package.json if it exists in the parent directory
        await addPackageJsonScripts(root, generatedFiles, templateDirName)

        // Step 6: Create README.md
        const readmeContent = await generateReadmeContent(
          templateName,
          templateDirName,
          generatedFiles
        )
        const readmeFilePath = path.join(templateDir, 'README.md')
        await fs.promises.writeFile(readmeFilePath, readmeContent, 'utf8')

        console.log('\n🎉 Template initialized successfully!')
        console.log(
          `\nTemplate created in: ${asPrimary(`./${templateDirName}/`)}`
        )
        console.log('\nYou can now build your template using:')

        switch (language) {
          case Language.TypeScript:
            console.log(
              `   ${asPrimary('npm run e2b:build:dev')} (for development)`
            )
            console.log(
              `   ${asPrimary('npm run e2b:build:prod')} (for production)`
            )
            console.log('\nOr directly:')
            console.log(
              `   ${asPrimary(
                `cd ${templateDirName} && npx tsx ${generatedFiles.buildDevFile}`
              )} (for development)`
            )
            console.log(
              `   ${asPrimary(
                `cd ${templateDirName} && npx tsx ${generatedFiles.buildProdFile}`
              )} (for production)`
            )
            break
          case Language.PythonAsync:
          case Language.PythonSync:
            console.log(
              `   ${asPrimary('npm run e2b:build:dev')} (for development)`
            )
            console.log(
              `   ${asPrimary('npm run e2b:build:prod')} (for production)`
            )
            console.log('\nOr directly:')
            console.log(
              `   ${asPrimary(
                `cd ${templateDirName} && python ${generatedFiles.buildDevFile}`
              )} (for development)`
            )
            console.log(
              `   ${asPrimary(
                `cd ${templateDirName} && python ${generatedFiles.buildProdFile}`
              )} (for production)`
            )
            break
          default:
            throw new Error('Unsupported language for instructions')
        }

        console.log(
          `\nLearn more about Sandbox Templates: ${asPrimary(
            'https://e2b.dev/docs'
          )}\n`
        )
      } catch (err: any) {
        console.error('Initialization failed:', err.message)
        process.exit(1)
      }
    }
  )
