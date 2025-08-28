import { Template, TemplateClass } from 'e2b'
import * as fs from 'fs'
import Handlebars from 'handlebars'
import * as path from 'path'
import { TemplateJSON } from './types'

// Track if helpers are registered to avoid duplicate registration
let helpersRegistered = false

export function registerHandlebarsHelpers() {
  if (helpersRegistered) return

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

  helpersRegistered = true
}

/**
 * Transform template data for Handlebars
 */
export async function transformTemplateData(template: TemplateClass) {
  // Extract JSON structure from parsed template
  const jsonString = await Template.toJSON(template, false)
  const json = JSON.parse(jsonString) as TemplateJSON

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
 * Convert the template to TypeScript code using Handlebars
 */
export async function generateTypeScriptCode(
  template: TemplateClass,
  alias: string,
  cpuCount?: number,
  memoryMB?: number
): Promise<{ templateContent: string; buildContent: string }> {
  registerHandlebarsHelpers()
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
 * Convert the template to Python code using Handlebars
 */
export async function generatePythonCode(
  template: TemplateClass,
  alias: string,
  cpuCount?: number,
  memoryMB?: number,
  isAsync: boolean = false
): Promise<{ templateContent: string; buildContent: string }> {
  registerHandlebarsHelpers()
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
