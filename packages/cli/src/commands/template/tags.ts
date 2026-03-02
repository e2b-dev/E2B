import * as tablePrinter from 'console-table-printer'
import * as commander from 'commander'

import { client, ensureAccessToken } from 'src/api'
import { teamOption } from '../../options'
import { handleE2BRequestError } from '../../utils/errors'

export const tagsCommand = new commander.Command('tags')
  .description('list tags for a sandbox template')
  .argument('<template>', 'template name or ID')
  .addOption(teamOption)
  .option('-f, --format <format>', 'output format, eg. json, pretty')
  .action(async (template: string, opts: { team: string; format: string }) => {
    try {
      const format = opts.format || 'pretty'
      ensureAccessToken()
      process.stdout.write('\n')

      const tags = await listTemplateTags(template)

      if (format === 'pretty') {
        renderTable(template, tags)
      } else if (format === 'json') {
        console.log(JSON.stringify(tags, null, 2))
      } else {
        console.error(`Unsupported output format: ${format}`)
        process.exit(1)
      }
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })

function renderTable(
  templateName: string,
  tags: { tag: string; buildID: string; createdAt: string }[]
) {
  if (!tags?.length) {
    console.log(`No tags found for template '${templateName}'.`)
    return
  }

  const table = new tablePrinter.Table({
    title: `Tags for template '${templateName}'`,
    columns: [
      { name: 'tag', alignment: 'left', title: 'Tag', color: 'orange' },
      { name: 'buildID', alignment: 'left', title: 'Build ID' },
      { name: 'createdAt', alignment: 'right', title: 'Created at' },
    ],
    rows: tags.map((tag) => ({
      ...tag,
      createdAt: new Date(tag.createdAt).toLocaleDateString(),
    })),
    style: {
      headerTop: {
        left: '',
        right: '',
        mid: '',
        other: '',
      },
      headerBottom: {
        left: '',
        right: '',
        mid: '',
        other: '',
      },
      tableBottom: {
        left: '',
        right: '',
        mid: '',
        other: '',
      },
      vertical: '',
    },
    colorMap: {
      orange: '\x1b[38;5;216m',
    },
  })
  table.printTable()

  process.stdout.write('\n')
}

async function listTemplateTags(
  template: string
): Promise<{ tag: string; buildID: string; createdAt: string }[]> {
  const res = await client.api.GET('/templates/{templateID}/tags', {
    params: {
      path: {
        templateID: template,
      },
    },
  })

  handleE2BRequestError(res, 'Error listing template tags')
  return res.data
}
