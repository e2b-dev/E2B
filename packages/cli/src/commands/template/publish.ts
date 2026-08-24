import * as commander from 'commander'
import * as chalk from 'chalk'

import {
  asBold,
  asFormattedError,
  asFormattedSandboxTemplate,
  SandboxTemplateRef,
} from 'src/utils/format'
import {
  deprecatedTeamOption,
  projectIdFromOptions,
  projectOption,
  selectMultipleOption,
} from 'src/options'
import { listSandboxTemplates } from './list'
import { getPromptTemplates } from 'src/utils/templatePrompt'
import { confirm } from 'src/utils/confirm'
import { client, resolveProjectId } from 'src/api'
import { handleE2BRequestError } from '../../utils/errors'

async function publishTemplate(templateID: string, publish: boolean) {
  const res = await client.api.PATCH('/v2/templates/{templateID}', {
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

  return res.data?.names ?? []
}

async function templateAction(
  publish: boolean,
  template: string,
  opts: {
    yes?: boolean
    select?: boolean
    project?: string
    team?: string
  }
) {
  try {
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
      chalk.default.underline(
        `Sandbox templates to ${publish ? 'publish' : 'unpublish'}`
      )
    )
    templates.forEach((e) => console.log(asFormattedSandboxTemplate(e)))
    process.stdout.write('\n')

    if (!opts.yes) {
      const confirmed = await confirm(
        `Do you really want to ${publish ? 'publish' : 'unpublish'} ${
          templates.length === 1 ? 'this template' : 'these templates'
        }?\n⚠️ This will make the ${
          templates.length === 1 ? 'template' : 'templates'
        } ${
          publish
            ? 'public to everyone outside your project'
            : 'private to your project'
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
          } sandbox template ${asFormattedSandboxTemplate(e)}`
        )
        const names = await publishTemplate(e.templateID, publish)
        if (publish && names.length > 0) {
          console.log(`  Published as: ${asBold(names.join(', '))}`)
        }
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
    )} to publish it, or select templates interactively with ${asBold('-s')}`
  )
  .addOption(selectMultipleOption)
  .addOption(projectOption)
  .addOption(deprecatedTeamOption)
  .alias('pb')
  .option('-y, --yes', 'skip manual publish confirmation')
  .action(templateAction.bind(null, true))

export const unPublishCommand = new commander.Command('unpublish')
  .description('unpublish sandbox template')
  .argument(
    '[template]',
    `specify ${asBold(
      '[template]'
    )} to unpublish it, or select templates interactively with ${asBold('-s')}`
  )
  .addOption(selectMultipleOption)
  .addOption(projectOption)
  .addOption(deprecatedTeamOption)
  .alias('upb')
  .option('-y, --yes', 'skip manual unpublish confirmation')
  .action(templateAction.bind(null, false))
