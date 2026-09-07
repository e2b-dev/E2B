import * as commander from 'commander'
import * as chalk from 'chalk'

import {
  asBold,
  asFormattedError,
  asFormattedSandboxTemplate,
  SandboxTemplateRef,
} from 'src/utils/format'
import {
  selectMultipleOption,
  deprecatedConfigOption,
  deprecatedTeamOption,
  projectIdFromOptions,
  projectOption,
  warnIgnoredConfigOption,
} from 'src/options'
import { listSandboxTemplates } from './list'
import { getPromptTemplates } from 'src/utils/templatePrompt'
import { confirm } from 'src/utils/confirm'
import { client, resolveProjectId } from 'src/api'
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
  .argument(
    '[template]',
    `specify ${asBold(
      '[template]'
    )} to delete it, or select templates interactively with ${asBold('-s')}`
  )
  .addOption(selectMultipleOption)
  .addOption(projectOption)
  .addOption(deprecatedTeamOption)
  .addOption(deprecatedConfigOption)
  .alias('dl')
  .option('-y, --yes', 'skip manual delete confirmation')
  .action(
    async (
      template,
      opts: {
        yes?: boolean
        select?: boolean
        project?: string
        team?: string
        config?: string
      }
    ) => {
      try {
        warnIgnoredConfigOption(opts)

        let projectId = projectIdFromOptions(opts)

        const templates: SandboxTemplateRef[] = []

        if (template) {
          templates.push({
            templateID: template,
          })
        } else if (opts.select) {
          projectId = resolveProjectId(projectId)

          const allTemplates = await listSandboxTemplates({
            projectId,
          })

          const selectedTemplates = await getPromptTemplates(
            allTemplates,
            'Select sandbox templates to delete'
          )
          templates.push(
            ...selectedTemplates.map((e) => ({
              templateID: e.templateID,
              aliases: e.aliases,
            }))
          )

          if (!templates || templates.length === 0) {
            console.log('No sandbox templates selected')
            return
          }
        }

        if (!templates || templates.length === 0) {
          console.log(
            `No sandbox templates selected. Specify sandbox template with ${asBold(
              '[template]'
            )} argument or use interactive mode with  ${asBold('-s')} flag.`
          )
          return
        }

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
