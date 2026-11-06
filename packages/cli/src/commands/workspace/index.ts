import * as commander from '@commander-js/extra-typings'

import { requireMe } from 'src/api'
import { Format, parseFormat } from 'src/options'
import { asFormattedError } from 'src/utils/format'
import { renderTable } from 'src/utils/table'
import { Workspace } from 'src/workspaces'

/** `active`, or `blocked` with its reasons. */
function workspaceStatus({ blocked, block_reasons }: Workspace) {
  if (!blocked) return 'active'
  return block_reasons.length
    ? `blocked (${block_reasons.join(', ')})`
    : 'blocked'
}

const listCommand = new commander.Command('list')
  .description('list the workspaces you can access')
  .alias('ls')
  .option(
    '-f, --format <format>',
    'output format, eg. json, pretty',
    parseFormat,
    Format.PRETTY
  )
  .action(async (opts) => {
    try {
      const { workspaces } = await requireMe()

      if (opts.format === Format.JSON) {
        console.log(
          JSON.stringify(
            workspaces.map(({ projects, ...workspace }) => ({
              ...workspace,
              project_count: projects.length,
            })),
            null,
            2
          )
        )
        return
      }

      if (!workspaces.length) {
        console.log('No workspaces found')
        return
      }
      renderTable(workspaces, [
        { header: 'Workspace ID', value: (w) => w.public_id },
        { header: 'Name', value: (w) => w.name },
        { header: 'Kind', value: (w) => w.kind },
        { header: 'Projects', value: (w) => String(w.projects.length) },
        { header: 'Status', value: workspaceStatus },
      ])
    } catch (err) {
      console.error(
        asFormattedError(err instanceof Error ? err.message : String(err))
      )
      process.exit(1)
    }
  })

export const workspaceCommand = new commander.Command('workspace')
  .description('work with workspaces')
  .alias('ws')
  .addCommand(listCommand)
