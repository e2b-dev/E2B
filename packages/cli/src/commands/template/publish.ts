import * as commander from 'commander'
import * as chalk from 'chalk'
import * as fs from 'fs'

import {
  asBold,
  asFormattedError,
  asFormattedSandboxTemplate,
  asLocal,
  asLocalRelative,
} from 'src/utils/format'
import {
  configOption,
  pathOption,
  selectMultipleOption,
  teamOption,
} from 'src/options'
import { configName, E2BConfig, getConfigPath, loadConfig } from 'src/config'
import { getRoot } from 'src/utils/filesystem'
import { listSandboxTemplates } from './list'
import { getPromptTemplates } from 'src/utils/templatePrompt'
import { confirm } from 'src/utils/confirm'
import { client } from 'src/api'
import { handleE2BRequestError } from '../../utils/errors'
import { getUserConfig } from 'src/user'

async function publishTemplate(templateID: string, publish: boolean) {
  const res = await client.api.PATCH('/templates/{templateID}', {
    params: {
      path: {
        templateID,
      },
    },
    body: {
      public: publish,
    },
  })

  handleE2BRequestError(
    res,
    `Error ${publish ? 'publishing' : 'unpublishing'} sandbox template`
  )
  return
}

async function templateAction(
  publish: boolean,
  template: string,
  opts: {
    path?: string
    config?: string
    yes?: boolean
    select?: boolean
    team?: string
  }
) {
  try {
    let teamId = opts.team

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
        teamId = teamId || userConfig.teamId
      }

      const allTemplates = await listSandboxTemplates({
        teamID: teamId,
      })

      const filteredTemplates = allTemplates.filter(
        (e) => !e.public === publish
      )

      if (filteredTemplates.length === 0) {
        console.log(
          `No sandbox templates available ${
            publish ? 'to publish' : 'to unpublish'
          } found`
        )
        return
      }

      const selectedTemplates = await getPromptTemplates(
        filteredTemplates,
        `Select sandbox templates to ${publish ? 'publish' : 'unpublish'}`
      )
      templates.push(
        ...selectedTemplates.map((e) => ({
          template_id: e.templateID,
          ...e,
        }))
      )

      if (!templates || templates.length === 0) {
        console.log('No sandbox templates selected')
        return
      }
    } else {
      const configPath = getConfigPath(root, opts.config)
      const config = fs.existsSync(configPath)
        ? await loadConfig(configPath)
        : undefined

      if (!config) {
        console.log(
          `No ${asLocal(configName)} found in ${asLocalRelative(
            root
          )}. Specify sandbox template with ${asBold(
            '[template]'
          )} argument or use interactive mode with ${asBold('-s')} flag.`
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
          '[template]'
        )} argument or use interactive mode with  ${asBold('-s')} flag.`
      )
      return
    }

    console.log(
      chalk.default.underline(
        `Sandbox templates to ${publish ? 'publish' : 'unpublish'}`
      )
    )
    templates.forEach((e) =>
      console.log(
        asFormattedSandboxTemplate(
          { ...e, templateID: e.template_id },
          e.configPath
        )
      )
    )
    process.stdout.write('\n')

    if (!opts.yes) {
      const confirmed = await confirm(
        `Do you really want to ${publish ? 'publish' : 'unpublish'} ${
          templates.length === 1 ? 'this template' : 'these templates'
        }?\n⚠️ This will make the ${
          templates.length === 1 ? 'template' : 'templates'
        } ${
          publish
            ? 'public to everyone outside your team'
            : 'private to your team'
        }`
      )

      if (!confirmed) {
        console.log('Canceled')
        return
      }
    }

    await Promise.all(
      templates.map(async (e) => {
        console.log(
          `- ${
            publish ? 'Publishing' : 'Unpublishing'
          } sandbox template ${asFormattedSandboxTemplate(
            { ...e, templateID: e.template_id },
            e.configPath
          )}`
        )
        await publishTemplate(e.template_id, publish)
      })
    )
    process.stdout.write('\n')
  } catch (err: any) {
    console.error(asFormattedError(err.message))
    process.exit(1)
  }
}

export const publishCommand = new commander.Command('publish')
  .description('publish sandbox template')
  .argument(
    '[template]',
    `specify ${asBold(
      '[template]'
    )} to publish it. If you dont specify ${asBold(
      '[template]'
    )} the command will try to publish sandbox template defined by ${asLocal(
      'e2b.toml'
    )}.`
  )
  .addOption(pathOption)
  .addOption(configOption)
  .addOption(selectMultipleOption)
  .addOption(teamOption)
  .alias('pb')
  .option('-y, --yes', 'skip manual publish confirmation')
  .action(templateAction.bind(null, true))

export const unPublishCommand = new commander.Command('unpublish')
  .description('unpublish sandbox template')
  .argument(
    '[template]',
    `specify ${asBold(
      '[template]'
    )} to unpublish it. If you don't specify ${asBold(
      '[template]'
    )} the command will try to unpublish sandbox template defined by ${asLocal(
      'e2b.toml'
    )}.`
  )
  .addOption(pathOption)
  .addOption(configOption)
  .addOption(selectMultipleOption)
  .addOption(teamOption)
  .alias('upb')
  .option('-y, --yes', 'skip manual unpublish confirmation')
  .action(templateAction.bind(null, false))
