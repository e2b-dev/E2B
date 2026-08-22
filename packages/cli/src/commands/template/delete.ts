import * as commander from 'commander'
import * as chalk from 'chalk'

import {
  asBold,
  asFormattedError,
  asFormattedSandboxTemplate,
} from 'src/utils/format'
import {
  selectMultipleOption,
  deprecatedTeamOption,
  projectIdFromOptions,
  projectOption,
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
  .argument('[template]', `specify ${asBold('[template]')} to delete it`)
  .addOption(selectMultipleOption)
  .addOption(projectOption)
  .addOption(deprecatedTeamOption)
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
      }
    ) => {
      try {
        let projectId = projectIdFromOptions(opts)

        const templates: { template_id: string; aliases?: string[] }[] = []

        if (template) {
          templates.push({
            template_id: template,
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
              template_id: e.templateID,
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
        templates.forEach((e) =>
          console.log(
            asFormattedSandboxTemplate({
              templateID: e.template_id,
              aliases: e.aliases,
            })
          )
        )
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
              `- Deleting sandbox template ${asFormattedSandboxTemplate({
                templateID: e.template_id,
                aliases: e.aliases,
              })}`
            )
            await deleteTemplate(e.template_id)
          })
        )
        process.stdout.write('\n')
      } catch (err: any) {
        console.error(asFormattedError(err.message))
        process.exit(1)
      }
    }
  )
