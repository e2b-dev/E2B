import * as commander from '@commander-js/extra-typings'
import * as chalk from 'chalk'
import { Template } from 'e2b'

import {
  asBold,
  asFormattedError,
  asFormattedSandboxTemplate,
  SandboxTemplateRef,
} from 'src/utils/format'
import { deprecatedConfigOption, warnIgnoredConfigOption } from 'src/options'
import { confirm } from 'src/utils/confirm'
import { ensureAuth } from 'src/api'

async function deleteTemplate(templateID: string) {
  const deleted = await Template.delete(templateID, await ensureAuth())
  if (!deleted) {
    throw new Error(`Sandbox template ${templateID} not found`)
  }
}

export const deleteCommand = new commander.Command('delete')
  .description('delete sandbox template')
  .argument('<template>', `specify ${asBold('<template>')} to delete it`)
  .addOption(deprecatedConfigOption)
  .alias('dl')
  .option('-y, --yes', 'skip manual delete confirmation')
  .action(async (template, opts) => {
    try {
      warnIgnoredConfigOption(opts)

      const templates: SandboxTemplateRef[] = [{ templateID: template }]

      console.log(
        chalk.default.red(
          chalk.default.underline('\nSandbox templates to delete')
        )
      )
      templates.forEach((e) => console.log(asFormattedSandboxTemplate(e)))
      process.stdout.write('\n')

      if (!opts.yes) {
        const confirmed = await confirm(
          `Do you really want to delete ${
            templates.length === 1 ? 'this template' : 'these templates'
          }?`
        )

        if (!confirmed) {
          console.log('Canceled')
          return
        }
      }

      await Promise.all(
        templates.map(async (e) => {
          console.log(
            `- Deleting sandbox template ${asFormattedSandboxTemplate(e)}`
          )
          await deleteTemplate(e.templateID)
        })
      )
      process.stdout.write('\n')
    } catch (err: any) {
      console.error(asFormattedError(err.message))
      process.exit(1)
    }
  })
