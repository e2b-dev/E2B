import * as path from 'path'
import { asLocalRelative, asPrimary } from '../../../utils/format'
import { GeneratedFiles, Language, languageDisplay } from './types'
import { generatePythonCode, generateTypeScriptCode } from './handlebars'
import { errorIfExists, writeFileContent } from './file-utils'
import { TemplateClass } from 'e2b'

/**
 * Generate and write template files for a given language
 */
export async function generateAndWriteTemplateFiles(
  root: string,
  alias: string,
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
          `${alias}-dev`,
          cpuCount,
          memoryMB
        )
      const { buildContent: buildProdContent } = await generateTypeScriptCode(
        template,
        alias,
        cpuCount,
        memoryMB
      )

      const extension = '.ts'
      const templateFile = errorIfExists(root, 'template', extension)
      const buildDevFile = errorIfExists(root, 'build.dev', extension)
      const buildProdFile = errorIfExists(root, 'build.prod', extension)

      await writeFileContent(path.join(root, templateFile), templateContent)
      await writeFileContent(path.join(root, buildDevFile), buildDevContent)
      await writeFileContent(path.join(root, buildProdFile), buildProdContent)

      console.log(
        `\n✅ Generated ${asPrimary(
          languageDisplay[Language.TypeScript]
        )} template files:`
      )
      console.log(`   ${asLocalRelative(templateFile)}`)
      console.log(`   ${asLocalRelative(buildDevFile)}`)
      console.log(`   ${asLocalRelative(buildProdFile)}`)

      return { templateFile, buildDevFile, buildProdFile, language }
    }
    case Language.PythonSync:
    case Language.PythonAsync: {
      const isAsync = language === Language.PythonAsync
      const { templateContent, buildContent: buildDevContent } =
        await generatePythonCode(
          template,
          `${alias}-dev`,
          cpuCount,
          memoryMB,
          isAsync
        )
      const { buildContent: buildProdContent } = await generatePythonCode(
        template,
        alias,
        cpuCount,
        memoryMB,
        isAsync
      )

      const extension = '.py'
      const templateFile = errorIfExists(root, 'template', extension)
      const buildDevFile = errorIfExists(root, 'build_dev', extension)
      const buildProdFile = errorIfExists(root, 'build_prod', extension)

      await writeFileContent(path.join(root, templateFile), templateContent)
      await writeFileContent(path.join(root, buildDevFile), buildDevContent)
      await writeFileContent(path.join(root, buildProdFile), buildProdContent)

      console.log(
        `\n✅ Generated ${asPrimary(languageDisplay[language])} template files:`
      )
      console.log(`   ${asLocalRelative(templateFile)}`)
      console.log(`   ${asLocalRelative(buildDevFile)}`)
      console.log(`   ${asLocalRelative(buildProdFile)}`)

      return { templateFile, buildDevFile, buildProdFile, language }
    }
    default:
      throw new Error('Unsupported language')
  }
}
