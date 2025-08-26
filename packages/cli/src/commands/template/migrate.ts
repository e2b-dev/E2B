import * as commander from 'commander'
import * as fs from 'fs'
import * as path from 'path'
import { select } from '@inquirer/prompts'
import CodeBlockWriter from 'code-block-writer'
import { getRoot } from 'src/utils/filesystem'
import { pathOption } from 'src/options'
import { getConfigPath, loadConfig, E2BConfig } from 'src/config'
import { asLocal, asLocalRelative, asPrimary } from 'src/utils/format'
import { defaultDockerfileName } from 'src/docker/constants'
import { Template, TemplateFinal } from 'e2b'
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

/**
 * Convert the JSON representation from Template.toJSON() to TypeScript code
 */
function jsonToTypeScript(
  json: TemplateJSON,
  alias: string,
  cpuCount?: number,
  memoryMB?: number
): { templateContent: string; buildContent: string } {
  const templateWriter = new CodeBlockWriter({ indentNumberOfSpaces: 2 })

  // Template file
  templateWriter.writeLine("import { Template } from 'e2b'")
  templateWriter.blankLine()
  templateWriter.write('export const template = Template()')

  // Handle base image or template
  if (json.fromImage) {
    templateWriter.newLine().indent().write(`.fromImage('${json.fromImage}')`)
  } else {
    throw new Error('Unsupported template Dockerfile')
  }

  // Process steps
  for (const step of json.steps) {
    switch (step.type) {
      case 'WORKDIR':
        templateWriter
          .newLine()
          .indent()
          .write(`.setWorkdir('${step.args[0]}')`)
        break
      case 'USER':
        templateWriter.newLine().indent().write(`.setUser('${step.args[0]}')`)
        break
      case 'ENV': {
        const envs: Record<string, string> = {}
        for (let i = 0; i < step.args.length; i += 2) {
          if (i + 1 < step.args.length) {
            envs[step.args[i]] = step.args[i + 1]
          }
        }
        if (Object.keys(envs).length > 0) {
          templateWriter
            .newLine()
            .setIndentationLevel(1)
            .write('.setEnvs(')
            .inlineBlock(() => {
              for (const [key, value] of Object.entries(envs)) {
                templateWriter.write(`'${key}': '${value}',`)
              }
            })
            .write(')')
            .setIndentationLevel(0)
        }
        break
      }
      case 'RUN': {
        templateWriter.newLine().indent().write(`.runCmd('${step.args[0]}')`)
        break
      }
      case 'COPY':
        if (step.args.length >= 2) {
          const src = step.args[0]
          let dest = step.args[step.args.length - 1]
          // Normalize empty or . destinations
          if (!dest || dest === '') {
            dest = '.'
          }
          templateWriter.newLine().indent().write(`.copy('${src}', '${dest}')`)
        }
        break
      default:
        // For unsupported instructions, add a comment
        templateWriter
          .newLine()
          .indent()
          .write(`// UNSUPPORTED: ${step.type} ${step.args.join(' ')}`)
    }
  }

  // Handle start and ready commands from config
  if (json.startCmd && json.readyCmd) {
    const startCmd = json.startCmd.replace(/'/g, "\\'")
    const readyCmd = json.readyCmd.replace(/'/g, "\\'")
    templateWriter
      .newLine()
      .indent()
      .write(`.setStartCmd('${startCmd}', '${readyCmd}')`)
  } else if (json.readyCmd) {
    const readyCmd = json.readyCmd.replace(/'/g, "\\'")
    templateWriter.newLine().indent().write(`.setReadyCmd('${readyCmd}')`)
  }

  // Generate build script
  const buildWriter = new CodeBlockWriter({ indentNumberOfSpaces: 2 })

  buildWriter.writeLine("import { Template } from 'e2b'")
  buildWriter.writeLine("import { template } from './template'")
  buildWriter.blankLine()
  buildWriter.write('await Template.build(template, ').inlineBlock(() => {
    buildWriter.writeLine(`alias: '${alias}',`)
    if (cpuCount) buildWriter.writeLine(`cpuCount: ${cpuCount},`)
    if (memoryMB) buildWriter.writeLine(`memoryMB: ${memoryMB},`)
  })
  buildWriter.write(')')

  return {
    templateContent: templateWriter.toString(),
    buildContent: buildWriter.toString(),
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
  const templateWriter = new CodeBlockWriter({
    indentNumberOfSpaces: 4,
    useTabs: false,
  })
  const templateImportClass = isAsync ? 'AsyncTemplate' : 'Template'

  // Template file
  templateWriter.writeLine(`from e2b import ${templateImportClass}`)
  templateWriter.blankLine()
  templateWriter.write('template = (')
  templateWriter.newLine().indent().write(`${templateImportClass}()`)

  // Handle base image or template
  if (json.fromImage) {
    templateWriter.newLine().indent().write(`.from_image("${json.fromImage}")`)
  } else {
    throw new Error('Unsupported template Dockerfile')
  }

  // Process steps
  for (const step of json.steps) {
    switch (step.type) {
      case 'WORKDIR':
        templateWriter
          .newLine()
          .indent()
          .write(`.set_workdir("${step.args[0]}")`)
        break
      case 'USER':
        templateWriter.newLine().indent().write(`.set_user("${step.args[0]}")`)
        break
      case 'ENV': {
        templateWriter.newLine().indent().write('.set_envs({')
        for (let i = 0; i < step.args.length; i += 2) {
          if (i + 1 < step.args.length) {
            templateWriter
              .newLine()
              .indent(2)
              .write(`"${step.args[i]}": "${step.args[i + 1]}",`)
          }
        }
        templateWriter.newLine().indent().write('})')
        break
      }
      case 'RUN': {
        templateWriter.newLine().indent().write(`.run_cmd("${step.args[0]}")`)
        break
      }
      case 'COPY':
        if (step.args.length >= 2) {
          const src = step.args[0]
          let dest = step.args[step.args.length - 1]
          // Normalize empty or . destinations
          if (!dest || dest === '') {
            dest = '.'
          }
          templateWriter.newLine().indent().write(`.copy("${src}", "${dest}")`)
        }
        break
      default:
        // For unsupported instructions, add a comment
        templateWriter
          .newLine()
          .indent()
          .write(`// UNSUPPORTED: ${step.type} ${step.args.join(' ')}`)
    }
  }

  // Handle start and ready commands from config
  if (json.startCmd && json.readyCmd) {
    const startCmd = json.startCmd.replace(/"/g, '\\"')
    const readyCmd = json.readyCmd.replace(/"/g, '\\"')
    templateWriter
      .newLine()
      .indent()
      .write(`.set_start_cmd("${startCmd}", "${readyCmd}")`)
  } else if (json.readyCmd) {
    const readyCmd = json.readyCmd.replace(/"/g, '\\"')
    templateWriter.newLine().indent().write(`.set_ready_cmd("${readyCmd}")`)
  }

  templateWriter.writeLine(')')

  // Generate build script
  const buildWriter = new CodeBlockWriter({
    indentNumberOfSpaces: 4,
    useTabs: false,
  })

  if (isAsync) {
    buildWriter.writeLine('import asyncio')
    buildWriter.writeLine(`from e2b import ${templateImportClass}`)
    buildWriter.writeLine('from template import template')
    buildWriter.blankLine()
    buildWriter.blankLine()
    buildWriter.writeLine('async def main():')
    buildWriter.setIndentationLevel(1)
    buildWriter.writeLine(`await ${templateImportClass}.build(`)
    buildWriter.setIndentationLevel(2)
    buildWriter.writeLine('template,')
    buildWriter.writeLine(`alias="${alias}",`)
    if (cpuCount) buildWriter.writeLine(`cpu_count=${cpuCount},`)
    if (memoryMB) buildWriter.writeLine(`memory_mb=${memoryMB},`)
    buildWriter.setIndentationLevel(1)
    buildWriter.writeLine(')')
    buildWriter.blankLine()
    buildWriter.blankLine()
    buildWriter.setIndentationLevel(0)
    buildWriter.writeLine('if __name__ == "__main__":')
    buildWriter.setIndentationLevel(1)
    buildWriter.writeLine('asyncio.run(main())')
  } else {
    buildWriter.writeLine(`from e2b import ${templateImportClass}`)
    buildWriter.writeLine('from template import template')
    buildWriter.blankLine()
    buildWriter.blankLine()
    buildWriter.writeLine(`${templateImportClass}.build(`)
    buildWriter.setIndentationLevel(1)
    buildWriter.writeLine('template,')
    buildWriter.writeLine(`alias="${alias}",`)
    if (cpuCount) buildWriter.writeLine(`cpu_count=${cpuCount},`)
    if (memoryMB) buildWriter.writeLine(`memory_mb=${memoryMB},`)
    buildWriter.setIndentationLevel(0)
    buildWriter.writeLine(')')
  }

  return {
    templateContent: templateWriter.toString(),
    buildContent: buildWriter.toString(),
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
  const baseTemplate = template.fromDockerfile(dockerfileContent)

  // Apply config start/ready commands
  let parsedTemplate: TemplateFinal = baseTemplate
  if (config.start_cmd) {
    parsedTemplate = baseTemplate.setStartCmd(
      config.start_cmd,
      config.ready_cmd || 'sleep 20'
    )
  } else if (config.ready_cmd) {
    parsedTemplate = baseTemplate.setReadyCmd(config.ready_cmd)
  }

  // Extract JSON structure from parsed template
  const json = JSON.parse(
    Template.toJSON(parsedTemplate, false)
  ) as TemplateJSON

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
    `specify target language: ${Object.keys(validLanguages).join(', ')}`,
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
