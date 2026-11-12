import * as path from 'path'
import { asLocalRelative, asPrimary } from '../../../utils/format'
import { GeneratedFiles, Language, languageDisplay } from './types'
import { generatePythonCode, generateTypeScriptCode } from './handlebars'
import { writeFileContent } from './file-utils'
import { TemplateClass } from 'e2b'

async function writeTemplateFiles(
  root: string,
  language: Language,
  files: {
    templateFile: string
    templateContent: string
    buildDevFile: string
    buildDevContent: string
    buildProdFile: string
    buildProdContent: string
  }
): Promise<GeneratedFiles> {
  const { templateFile, buildDevFile, buildProdFile } = files

  await writeFileContent(path.join(root, templateFile), files.templateContent)
  await writeFileContent(path.join(root, buildDevFile), files.buildDevContent)
  await writeFileContent(path.join(root, buildProdFile), files.buildProdContent)

  console.log(
    `\n✅ Generated ${asPrimary(languageDisplay[language])} template files:`
  )
  console.log(`   ${asLocalRelative(templateFile)}`)
  console.log(`   ${asLocalRelative(buildDevFile)}`)
  console.log(`   ${asLocalRelative(buildProdFile)}`)

  return { templateFile, buildDevFile, buildProdFile, language }
}

/**
 * Generate and write template files for a given language
 */
export async function generateAndWriteTemplateFiles(
  root: string,
  name: string,
  language: Language,
  template: TemplateClass,
  cpuCount?: number,
  memoryMB?: number
): Promise<GeneratedFiles> {
  switch (language) {
    case Language.TypeScript: {
      const { templateContent, buildContent: buildDevContent } =
        await generateTypeScriptCode(
          template,
          `${name}-dev`,
          cpuCount,
          memoryMB
        )
      const { buildContent: buildProdContent } = await generateTypeScriptCode(
        template,
        name,
        cpuCount,
        memoryMB
      )

      return writeTemplateFiles(root, language, {
        templateFile: 'template.ts',
        templateContent,
        buildDevFile: 'build.dev.ts',
        buildDevContent,
        buildProdFile: 'build.prod.ts',
        buildProdContent,
      })
    }
    case Language.PythonSync:
    case Language.PythonAsync: {
      const isAsync = language === Language.PythonAsync
      const { templateContent, buildContent: buildDevContent } =
        await generatePythonCode(
          template,
          `${name}-dev`,
          cpuCount,
          memoryMB,
          isAsync
        )
      const { buildContent: buildProdContent } = await generatePythonCode(
        template,
        name,
        cpuCount,
        memoryMB,
        isAsync
      )

      return writeTemplateFiles(root, language, {
        templateFile: 'template.py',
        templateContent,
        buildDevFile: 'build_dev.py',
        buildDevContent,
        buildProdFile: 'build_prod.py',
        buildProdContent,
      })
    }
    default:
      throw new Error('Unsupported language')
  }
}
