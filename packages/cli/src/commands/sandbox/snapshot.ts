import * as commander from 'commander'
import { NotFoundError, Sandbox, SnapshotInfo } from 'e2b'

import { ensureAPIKey } from 'src/api'
import { asBold } from 'src/utils/format'
import { renderTable } from 'src/utils/table'

const DEFAULT_LIMIT = 1000
const PAGE_LIMIT = 100

const createSnapshotCommand = new commander.Command('create')
  .description('create a snapshot from a sandbox')
  .argument('<sandboxID>', `create a snapshot from ${asBold('<sandboxID>')}`)
  .alias('cr')
  .option(
    '-n, --name <name>',
    'name for the snapshot template, reuses the existing template if it already exists'
  )
  .action(async (sandboxID: string, options: { name?: string }) => {
    try {
      const apiKey = ensureAPIKey()

      const snapshot = await Sandbox.createSnapshot(sandboxID, {
        apiKey,
        name: options.name,
      })

      console.log(
        `Created snapshot ${asBold(snapshot.snapshotId)} from sandbox ${asBold(
          sandboxID
        )}`
      )
    } catch (err: any) {
      if (err instanceof NotFoundError) {
        console.error(`Sandbox ${asBold(sandboxID)} wasn't found`)
      } else {
        console.error(err)
      }
      process.exit(1)
    }
  })

const listSnapshotsCommand = new commander.Command('list')
  .description('list snapshots')
  .argument(
    '[sandboxID]',
    `list only snapshots created from ${asBold('[sandboxID]')}`
  )
  .alias('ls')
  .option(
    '-n, --name <name>',
    'filter by snapshot name or ID, optionally tag-qualified, eg. my-snapshot:v1'
  )
  .option(
    '-l, --limit <limit>',
    `limit the number of snapshots returned (default: ${DEFAULT_LIMIT}, 0 for no limit)`,
    (value) => parseInt(value)
  )
  .option('-f, --format <format>', 'output format, eg. json, pretty')
  .action(
    async (
      sandboxID: string | undefined,
      options: { name?: string; format?: string; limit?: number }
    ) => {
      try {
        const apiKey = ensureAPIKey()
        const format = options.format || 'pretty'
        const limit =
          options.limit === 0 ? undefined : (options.limit ?? DEFAULT_LIMIT)

        let pageLimit = limit
        if (!limit || limit > PAGE_LIMIT) {
          pageLimit = PAGE_LIMIT
        }

        const allSnapshots: SnapshotInfo[] = []
        const paginator = Sandbox.listSnapshots({
          apiKey,
          sandboxId: sandboxID,
          name: options.name,
          limit: pageLimit,
        })

        while (paginator.hasNext && (!limit || allSnapshots.length < limit)) {
          const batch = await paginator.nextItems()
          allSnapshots.push(...batch)
        }

        const snapshots = limit ? allSnapshots.slice(0, limit) : allSnapshots
        const hasMore =
          paginator.hasNext || (limit ? allSnapshots.length > limit : false)

        if (format === 'pretty') {
          renderSnapshotTable(snapshots)
          if (hasMore) {
            console.log(
              `Showing first ${limit} snapshots. Use --limit to change.`
            )
          }
        } else if (format === 'json') {
          console.log(JSON.stringify(snapshots, null, 2))
        } else {
          console.error(`Unsupported output format: ${format}`)
          process.exit(1)
        }
      } catch (err: any) {
        console.error(err)
        process.exit(1)
      }
    }
  )

const deleteSnapshotCommand = new commander.Command('delete')
  .description('delete snapshots')
  .argument(
    '<snapshotIDs...>',
    `delete the snapshots specified by ${asBold('<snapshotIDs...>')}`
  )
  .alias('dl')
  .action(async (snapshotIDs: string[]) => {
    try {
      const apiKey = ensureAPIKey()

      const results = await Promise.allSettled(
        snapshotIDs.map(async (snapshotID) => {
          const deleted = await Sandbox.deleteSnapshot(snapshotID, { apiKey })
          if (deleted) {
            console.log(`Snapshot ${asBold(snapshotID)} has been deleted`)
          } else {
            console.error(`Snapshot ${asBold(snapshotID)} wasn't found`)
          }
        })
      )

      const failures = results.filter(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected'
      )
      for (const failure of failures) {
        console.error(failure.reason)
      }
      if (failures.length > 0) {
        process.exit(1)
      }
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })

export const snapshotCommand = new commander.Command('snapshot')
  .description('work with sandbox snapshots')
  .alias('snap')
  .addCommand(createSnapshotCommand)
  .addCommand(listSnapshotsCommand)
  .addCommand(deleteSnapshotCommand)

function renderSnapshotTable(snapshots: SnapshotInfo[]) {
  if (!snapshots?.length) {
    console.log('No snapshots found')
    return
  }

  renderTable(snapshots, [
    { header: 'Snapshot ID', value: (snapshot) => snapshot.snapshotId },
    {
      header: 'Names',
      value: (snapshot) => snapshot.names.map(stripControlChars).join(', '),
    },
  ])
}

function stripControlChars(value: string) {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
}
