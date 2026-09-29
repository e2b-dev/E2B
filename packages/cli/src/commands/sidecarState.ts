import * as commander from 'commander'
import {
  NotFoundError,
  Sandbox,
  SidecarStateInfo,
  SidecarStateVersionInfo,
} from 'e2b'

import { ensureAPIKey } from 'src/api'
import { asBold } from 'src/utils/format'
import { formatTable } from 'src/utils/table'

const listCommand = new commander.Command('list')
  .description("list the team's saved sidecar states")
  .alias('ls')
  .option('-f, --format <format>', 'output format, eg. json, pretty')
  .action(async (options: { format?: string }) => {
    try {
      const apiKey = ensureAPIKey()
      const format = options.format || 'pretty'

      const states = await Sandbox.listSidecarStates({ apiKey })

      if (format === 'pretty') {
        if (!states.length) {
          console.log('No sidecar states found')
          return
        }
        renderSidecarStateTable(states)
      } else if (format === 'json') {
        console.log(JSON.stringify(states, null, 2))
      } else {
        console.error(`Unsupported output format: ${format}`)
        process.exit(1)
      }
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })

const getCommand = new commander.Command('get')
  .description('show a saved sidecar state and its versions')
  .argument('<name>', `show the sidecar state named ${asBold('<name>')}`)
  .option('-f, --format <format>', 'output format, eg. json, pretty')
  .action(async (name: string, options: { format?: string }) => {
    try {
      const apiKey = ensureAPIKey()
      const format = options.format || 'pretty'

      const state = await Sandbox.getSidecarState(name, { apiKey })

      if (format === 'pretty') {
        console.log(
          `Sidecar state ${asBold(state.name)} (${state.entry}, ${
            state.sizeMiB
          } MiB), ${state.versionCount} version(s)\n`
        )
        renderSidecarStateVersionTable(state.versions)
      } else if (format === 'json') {
        console.log(JSON.stringify(state, null, 2))
      } else {
        console.error(`Unsupported output format: ${format}`)
        process.exit(1)
      }
    } catch (err: any) {
      if (err instanceof NotFoundError) {
        console.error(`Sidecar state ${asBold(name)} wasn't found`)
      } else {
        console.error(err)
      }
      process.exit(1)
    }
  })

/**
 * `parseInt` reads a prefix: it turns `2.9`, `2junk` and `1e2` into a version
 * the operator did not ask to delete. The whole argument has to be a decimal
 * integer.
 */
export function parseVersionOption(value: string): number {
  const version = /^\d+$/.test(value) ? Number(value) : NaN
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new commander.InvalidArgumentError('expected a positive integer.')
  }

  return version
}

const deleteCommand = new commander.Command('delete')
  .description('delete a saved sidecar state, or one of its versions')
  .argument('<name>', `delete the sidecar state named ${asBold('<name>')}`)
  .alias('dl')
  .option(
    '-v, --version <version>',
    'delete only this version; deleting the last version deletes the name',
    parseVersionOption
  )
  .action(async (name: string, options: { version?: number }) => {
    try {
      const apiKey = ensureAPIKey()

      await Sandbox.deleteSidecarState(name, {
        apiKey,
        version: options.version,
      })

      console.log(
        options.version === undefined
          ? `Sidecar state ${asBold(name)} has been deleted`
          : `Version ${asBold(String(options.version))} of sidecar state ${asBold(
              name
            )} has been deleted`
      )
    } catch (err: any) {
      if (err instanceof NotFoundError) {
        // The 404 is either an unknown name or an unknown version, and the
        // SDK maps both to NotFoundError; naming the version is true of both
        // when one was asked for.
        console.error(
          options.version === undefined
            ? `Sidecar state ${asBold(name)} wasn't found`
            : `Version ${asBold(
                String(options.version)
              )} of sidecar state ${asBold(name)} wasn't found`
        )
      } else {
        console.error(err)
      }
      process.exit(1)
    }
  })

const saveCommand = new commander.Command('save')
  .description("save a running sidecar's data disk under a name")
  .argument('<sandboxID>', `save a sidecar of ${asBold('<sandboxID>')}`)
  .argument('<entry>', `catalog entry of the sidecar, eg. ${asBold('sqlite')}`)
  .argument('<name>', `add a version under the state named ${asBold('<name>')}`)
  .action(async (sandboxID: string, entry: string, name: string) => {
    try {
      const apiKey = ensureAPIKey()

      const version = await Sandbox.saveSidecarState(sandboxID, entry, name, {
        apiKey,
      })

      console.log(
        `Saved ${asBold(entry)} of sandbox ${asBold(
          sandboxID
        )} as ${asBold(`${version.name}:${version.version}`)} (${formatBytes(
          version.sizeBytes
        )})`
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

export const sidecarStateCommand = new commander.Command('sidecar-state')
  .description("work with the team's saved sidecar states")
  .alias('scs')
  .addCommand(listCommand)
  .addCommand(getCommand)
  .addCommand(deleteCommand)
  .addCommand(saveCommand)

export function formatSidecarStateTable(states: SidecarStateInfo[]): string[] {
  return formatTable(states, [
    { header: 'Name', value: (state) => state.name },
    { header: 'Entry', value: (state) => state.entry },
    { header: 'Size MiB', value: (state) => String(state.sizeMiB) },
    { header: 'Latest', value: (state) => String(state.latestVersion) },
    { header: 'Versions', value: (state) => String(state.versionCount) },
    {
      header: 'Updated at',
      value: (state) => state.updatedAt.toLocaleString(),
    },
  ])
}

export function formatSidecarStateVersionTable(
  versions: SidecarStateVersionInfo[]
): string[] {
  return formatTable(versions, [
    { header: 'Version', value: (version) => String(version.version) },
    { header: 'Entry version', value: (version) => version.entryVersion },
    { header: 'Size', value: (version) => formatBytes(version.sizeBytes) },
    { header: 'Source sandbox', value: (version) => version.sourceSandboxId },
    {
      header: 'Created at',
      value: (version) => version.createdAt.toLocaleString(),
    },
  ])
}

function renderSidecarStateTable(states: SidecarStateInfo[]) {
  for (const line of formatSidecarStateTable(states)) {
    console.log(line)
  }
}

function renderSidecarStateVersionTable(versions: SidecarStateVersionInfo[]) {
  for (const line of formatSidecarStateVersionTable(versions)) {
    console.log(line)
  }
}

const UNITS = ['B', 'KiB', 'MiB', 'GiB']

function formatBytes(bytes: number): string {
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit += 1
  }
  return unit === 0 ? `${value} B` : `${value.toFixed(1)} ${UNITS[unit]}`
}
