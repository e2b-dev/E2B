import * as commander from 'commander'
import * as chalk from 'chalk'
import * as e2b from 'e2b'
import * as fs from 'fs'

import { ensureAccessToken } from 'src/api'

import {
  asBold,
  asFormattedError,
  asFormattedSandboxTemplate,
  asLocal,
  asLocalRelative,
} from 'src/utils/format'
import { configOption, pathOption, selectMultipleOption, teamOption } from 'src/options'
import {
  E2BConfig,
  configName,
  deleteConfig,
  getConfigPath,
  loadConfig,
} from 'src/config'
import { getRoot } from 'src/utils/filesystem'
import { listSandboxTemplates } from './list'
import { getPromptTemplates } from 'src/utils/templatePrompt'
import { confirm } from 'src/utils/confirm'
import { client } from 'src/api'
import { getUserConfig } from 'src/user'

const deleteTemplate = e2b.withAccessToken(
  client.api.path('/templates/{templateID}').method('delete').create(),
)

export const deleteCommand = new commander.Command('delete')
  .description(`delete sandbox template and ${asLocal(configName)} config`)
  .argument(
    '[template]',
    `specify ${asBold('[template]')} to delete it. If you dont specify ${asBold(
      '[template]',
    )} the command will try to delete sandbox template defined by ${asLocal(
      'e2b.toml',
    )}.`,
  )
  .addOption(pathOption)
  .addOption(configOption)
  .addOption(selectMultipleOption)
  .addOption(teamOption)
  .alias('dl')
  .option('-y, --yes', 'skip manual delete confirmation')
  .action(
    async (
      template,
      opts: {
        path?: string
        config?: string
        yes?: boolean
        select?: boolean
        team?: string
      },
    ) => {
      try {
        let teamId = opts.team

        const accessToken = ensureAccessToken()
        const root = getRoot(opts.path)

        const templates: (Pick<E2BConfig, 'template_id'> & {
          configPath?: string
        })[] = []

        if (template) {
          templates.push({
            template_id: template,
          })
        } else if (opts.select) {
          const userConfig = getUserConfig()
          if (userConfig) {
            teamId = teamId || userConfig.teamId || userConfig.defaultTeamId! // default team ID is here for backwards compatibility
          }

          const allTemplates = await listSandboxTemplates({
            accessToken: accessToken,
            teamID: teamId,
          })
          const selectedTemplates = await getPromptTemplates(
            allTemplates,
            'Select sandbox templates to delete',
          )
          templates.push(
            ...selectedTemplates.map((e) => ({
              template_id: e.templateID,
              ...e,
            })),
          )

          if (!templates || templates.length === 0) {
            console.log('No sandbox templates selected')
            return
          }
        } else {
          const configPath = getConfigPath(root)
          const config = fs.existsSync(configPath)
            ? await loadConfig(configPath)
            : undefined

          if (!config) {
            console.log(
              `No ${asLocal(configName)} found in ${asLocalRelative(
                root,
              )}. Specify sandbox template with ${asBold(
                '[template]',
              )} argument or use interactive mode with ${asBold('-s')} flag.`,
            )
            return
          }

          templates.push({
            ...config,
            configPath,
          })
        }

        if (!templates || templates.length === 0) {
          console.log(
            `No sandbox templates selected. Specify sandbox template with ${asBold(
              '[template]',
            )} argument or use interactive mode with  ${asBold('-s')} flag.`,
          )
          return
        }

        console.log(
          chalk.default.red(
            chalk.default.underline('\nSandbox templates to delete'),
          ),
        )
        templates.forEach((e) =>
          console.log(
            asFormattedSandboxTemplate(
              { ...e, templateID: e.template_id },
              e.configPath,
            ),
          ),
        )
        process.stdout.write('\n')

        if (!opts.yes) {
          const confirmed = await confirm(
            `Do you really want to delete ${templates.length === 1 ? 'this template' : 'these templates'
            }?`,
          )

          if (!confirmed) {
            console.log('Canceled')
            return
          }
        }

        await Promise.all(
          templates.map(async (e) => {
            console.log(
              `- Deleting sandbox template ${asFormattedSandboxTemplate(
                { ...e, templateID: e.template_id },
                e.configPath,
              )}`,
            )
            await deleteTemplate(accessToken, { templateID: e.template_id })
            if (e.configPath) {
              await deleteConfig(e.configPath)
            }
          }),
        )
        process.stdout.write('\n')
      } catch (err: any) {
        console.error(asFormattedError(err.message))
        process.exit(1)
      }
    },
  )
