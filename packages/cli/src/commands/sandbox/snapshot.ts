import * as tablePrinter from 'console-table-printer'
import * as commander from 'commander'
import { Sandbox, SnapshotInfo } from 'e2b'

import { ensureAPIKey } from 'src/api'
import { asBold } from 'src/utils/format'

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
      console.error(err)
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
  .option('-f, --format <format>', 'output format, eg. json, pretty')
  .action(
    async (
      sandboxID: string | undefined,
      options: { name?: string; format?: string }
    ) => {
      try {
        const apiKey = ensureAPIKey()
        const format = options.format || 'pretty'

        const snapshots: SnapshotInfo[] = []
        const paginator = Sandbox.listSnapshots({
          apiKey,
          sandboxId: sandboxID,
          name: options.name,
        })

        while (paginator.hasNext) {
          const batch = await paginator.nextItems()
          snapshots.push(...batch)
        }

        if (format === 'pretty') {
          renderTable(snapshots)
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

      await Promise.all(
        snapshotIDs.map(async (snapshotID) => {
          const deleted = await Sandbox.deleteSnapshot(snapshotID, { apiKey })
          if (deleted) {
            console.log(`Snapshot ${asBold(snapshotID)} has been deleted`)
          } else {
            console.error(`Snapshot ${asBold(snapshotID)} wasn't found`)
          }
        })
      )
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

function renderTable(snapshots: SnapshotInfo[]) {
  if (!snapshots?.length) {
    console.log('No snapshots found')
    return
  }

  const table = new tablePrinter.Table({
    title: 'Snapshots',
    columns: [
      { name: 'snapshotId', alignment: 'left', title: 'Snapshot ID' },
      { name: 'names', alignment: 'left', title: 'Names' },
    ],
    rows: snapshots.map((snapshot) => ({
      ...snapshot,
      names: snapshot.names.join(', '),
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
