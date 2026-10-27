import * as commander from 'commander'
import * as chalk from 'chalk'

import {
  asBold,
  asFormattedError,
  asFormattedSandboxTemplate,
  SandboxTemplateRef,
} from 'src/utils/format'
import {
  deprecatedConfigOption,
  deprecatedTeamOption,
  projectOption,
  warnIgnoredConfigOption,
} from 'src/options'
import { confirm } from 'src/utils/confirm'
import { client } from 'src/api'
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
    project?: string
    team?: string
    config?: string
  }
) {
  try {
    warnIgnoredConfigOption(opts)

    const templates: SandboxTemplateRef[] = [{ templateID: template }]

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
  .argument('<template>', `specify ${asBold('<template>')} to publish it`)
  .addOption(projectOption)
  .addOption(deprecatedTeamOption)
  .addOption(deprecatedConfigOption)
  .alias('pb')
  .option('-y, --yes', 'skip manual publish confirmation')
  .action(templateAction.bind(null, true))

export const unPublishCommand = new commander.Command('unpublish')
  .description('unpublish sandbox template')
  .argument('<template>', `specify ${asBold('<template>')} to unpublish it`)
  .addOption(projectOption)
  .addOption(deprecatedTeamOption)
  .addOption(deprecatedConfigOption)
  .alias('upb')
  .option('-y, --yes', 'skip manual unpublish confirmation')
  .action(templateAction.bind(null, false))
