import { Template, TemplateClass } from 'e2b'
import * as fs from 'fs'
import HandlebarsLib from 'handlebars'
import * as path from 'path'
import {
  GeneratedFiles,
  Language,
  TemplateJSON,
  TemplateWithStepsJSON,
} from './types'

class Handlebars {
  private handlebars: typeof HandlebarsLib

  constructor() {
    const handlebars = HandlebarsLib.create()
    handlebars.registerHelper('eq', function (a: any, b: any, options: any) {
      if (a === b) {
        // @ts-ignore - this context is provided by Handlebars
        return options.fn(this)
      }
      return ''
    })

    handlebars.registerHelper('escapeQuotes', function (str) {
      return str ? str.replace(/'/g, "\\'") : str
    })

    handlebars.registerHelper('escapeDoubleQuotes', function (str) {
      return str ? str.replace(/"/g, '\\"') : str
    })

    this.handlebars = handlebars
  }

  compile(template: string) {
    return this.handlebars.compile(template)
  }
}

interface HandlebarStep {
  type: string
  args?: string[]
  envVars?: Record<string, string>
  src?: string
  dest?: string
}

/**
 * Transform template data for Handlebars
 */
export async function transformTemplateData(
  template: TemplateClass
): Promise<TemplateJSON & { steps: HandlebarStep[] }> {
  // Extract JSON structure from parsed template
  const jsonString = await Template.toJSON(template, false)
  const json = JSON.parse(jsonString) as TemplateWithStepsJSON

  const transformedSteps: HandlebarStep[] = []

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
          let dest = step.args[1]
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
 * Convert the template to TypeScript code using Handlebars
 */
export async function generateTypeScriptCode(
  template: TemplateClass,
  alias: string,
  cpuCount?: number,
  memoryMB?: number
): Promise<{ templateContent: string; buildContent: string }> {
  const hb = new Handlebars()
  const transformedData = await transformTemplateData(template)

  // Load and compile templates
  // In dist, templates are at dist/templates/, __dirname is dist/
  const templatesDir = path.join(__dirname, 'templates')
  const templateSource = fs.readFileSync(
    path.join(templatesDir, 'typescript-template.hbs'),
    'utf8'
  )
  const buildSource = fs.readFileSync(
    path.join(templatesDir, 'typescript-build.hbs'),
    'utf8'
  )

  const generateTemplateSource = hb.compile(templateSource)
  const generateBuildSource = hb.compile(buildSource)

  // Generate content
  const templateData = {
    ...transformedData,
  }

  const templateContent = generateTemplateSource(templateData)

  const buildContent = generateBuildSource({
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
 * Convert the template to Python code using Handlebars
 */
export async function generatePythonCode(
  template: TemplateClass,
  alias: string,
  cpuCount?: number,
  memoryMB?: number,
  isAsync: boolean = false
): Promise<{ templateContent: string; buildContent: string }> {
  const hb = new Handlebars()
  const transformedData = await transformTemplateData(template)

  // Load and compile templates
  // In dist, templates are at dist/templates/, __dirname is dist/
  const templatesDir = path.join(__dirname, 'templates')
  const templateSource = fs.readFileSync(
    path.join(templatesDir, 'python-template.hbs'),
    'utf8'
  )
  const buildSource = fs.readFileSync(
    path.join(templatesDir, `python-build-${isAsync ? 'async' : 'sync'}.hbs`),
    'utf8'
  )

  const generateTemplateSource = hb.compile(templateSource)
  const generateBuildSource = hb.compile(buildSource)

  // Generate content
  const templateContent = generateTemplateSource({
    ...transformedData,
    isAsync,
  })

  const buildContent = generateBuildSource({
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
 * Generate README.md content using Handlebars
 */
export async function generateReadmeContent(
  alias: string,
  templateDir: string,
  generatedFiles: GeneratedFiles
): Promise<string> {
  const hb = new Handlebars()

  // Load and compile README template
  const templatesDir = path.join(__dirname, 'templates')
  const readmeSource = fs.readFileSync(
    path.join(templatesDir, 'readme.hbs'),
    'utf8'
  )

  const generateReadmeSource = hb.compile(readmeSource)

  // Prepare template data
  const templateData = {
    alias,
    templateDir,
    templateFile: generatedFiles.templateFile,
    buildDevFile: generatedFiles.buildDevFile,
    buildProdFile: generatedFiles.buildProdFile,
    isTypeScript: generatedFiles.language === Language.TypeScript,
    isPython:
      generatedFiles.language === Language.PythonSync ||
      generatedFiles.language === Language.PythonAsync,
    isPythonSync: generatedFiles.language === Language.PythonSync,
    isPythonAsync: generatedFiles.language === Language.PythonAsync,
  }

  return generateReadmeSource(templateData).trim()
}
