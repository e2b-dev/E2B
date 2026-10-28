import * as commander from 'commander'
import * as chalk from 'chalk'

import {
  asBold,
  asFormattedError,
  asFormattedSandboxTemplate,
  SandboxTemplateRef,
} from 'src/utils/format'
import { deprecatedConfigOption, warnIgnoredConfigOption } from 'src/options'
import { confirm } from 'src/utils/confirm'
import { client } from 'src/api'
import { handleE2BRequestError } from '../../utils/errors'

async function deleteTemplate(templateID: string) {
  const res = await client.api.DELETE('/templates/{templateID}', {
    params: {
      path: {
        templateID,
      },
    },
  })

  handleE2BRequestError(res, 'Error deleting sandbox template')
  return
}

export const deleteCommand = new commander.Command('delete')
  .description('delete sandbox template')
  .argument('<template>', `specify ${asBold('<template>')} to delete it`)
  .addOption(deprecatedConfigOption)
  .alias('dl')
  .option('-y, --yes', 'skip manual delete confirmation')
  .action(
    async (
      template,
      opts: {
        yes?: boolean
        config?: string
      }
    ) => {
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
    }
  )
