import * as path from 'path'
import { asLocalRelative, asPrimary } from 'src/utils/format'
import { GeneratedFiles, Language, languageDisplay } from './types'
import { generatePythonCode, generateTypeScriptCode } from './handlebars'
import { getUniqueFileName, writeFileContent } from './file-utils'
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
  if (language === Language.TypeScript) {
    const { templateContent, buildContent: buildDevContent } =
      await generateTypeScriptCode(template, `${alias}-dev`, cpuCount, memoryMB)
    const { buildContent: buildProdContent } = await generateTypeScriptCode(
      template,
      alias,
      cpuCount,
      memoryMB
    )

    const extension = '.ts'
    const templateFile = getUniqueFileName(root, 'template', extension)
    const buildDevFile = getUniqueFileName(root, 'build.dev', extension)
    const buildProdFile = getUniqueFileName(root, 'build.prod', extension)

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
  } else {
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
    const templateFile = getUniqueFileName(root, 'template', extension)
    const buildDevFile = getUniqueFileName(root, 'build_dev', extension)
    const buildProdFile = getUniqueFileName(root, 'build_prod', extension)

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
}
