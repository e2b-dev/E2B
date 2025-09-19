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
  validLanguages,
} from './generators'
import { generateReadmeContent } from './generators/handlebars'

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
  const template = Template()
    .fromImage('ubuntu:22.04')
    .runCmd('echo Hello World E2B!')

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
    const pkgJson = await PackageJson.load(root)

    // Generate script commands based on language and directory structure
    const cdPrefix = templateDirName ? `cd ${templateDirName} && ` : ''

    if (files.language === Language.TypeScript) {
      pkgJson.update({
        scripts: {
          ...pkgJson.content.scripts,
          'e2b:build:dev': `${cdPrefix}npx tsx ${files.buildDevFile}`,
          'e2b:build:prod': `${cdPrefix}npx tsx ${files.buildProdFile}`,
        },
      })
    } else {
      pkgJson.update({
        scripts: {
          ...pkgJson.content.scripts,
          'e2b:build:dev': `${cdPrefix}python ${files.buildDevFile}`,
          'e2b:build:prod': `${cdPrefix}python ${files.buildProdFile}`,
        },
      })
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
 * Validate template name format
 */
function validateTemplateName(name: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*[a-z0-9]$|^[a-z0-9]$/.test(name)
}

export const initV2Command = new commander.Command('init-v2')
  .description('initialize a new sandbox template using the SDK')
  .addOption(pathOption)
  .option('-n, --name <name>', 'template name (alias)')
  .option(
    '-l, --language <language>',
    `target language: ${validLanguages.join(', ')}`,
    (value) => {
      if (!validLanguages.includes(value as Language)) {
        throw new Error(
          `Invalid language. Must be one of: ${validLanguages.join(', ')}`
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
        let templateName: string
        if (opts.name) {
          if (!validateTemplateName(opts.name)) {
            throw new Error(
              'Template name must contain only lowercase letters, numbers, hyphens, and underscores, and cannot start or end with a hyphen or underscore'
            )
          }
          templateName = opts.name
          console.log(`Using template name: ${templateName}`)
        } else {
          templateName = await input({
            message: 'Enter template name (alias):',
            default: 'my-template',
            validate: (input: string) => {
              if (!input || input.trim().length === 0) {
                return 'Template name cannot be empty'
              }
              if (!validateTemplateName(input.trim())) {
                return 'Template name must contain only lowercase letters, numbers, hyphens, and underscores, and cannot start or end with a hyphen or underscore'
              }
              return true
            },
          })
        }
        templateName = templateName.trim()

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

        if (language === Language.TypeScript) {
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
        } else {
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
