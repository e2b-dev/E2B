import * as sdk from '@e2b/sdk'
import * as commander from 'commander'
import chokidar from 'chokidar'
import fs from 'fs/promises'
import path from 'path'
import parseGitignore from 'parse-gitignore'

import { DevbookConfig } from 'src/config'
import { pathOption } from 'src/options'
import { spawnConnectedTerminal } from 'src/terminal'
import { getRoot } from 'src/utils/filesystem'
import { asFormattedEnvironment, asFormattedError, asBold } from 'src/utils/format'
import { createDeferredPromise } from 'src/utils/promise'

const rootdir = '/code'
const envID = 'QFNlQVCzcKxD'

export const runCommand = new commander.Command('run')
  .description('Start remote development')
  .addOption(pathOption)
  .alias('rn')
  .action(async opts => {
    let stopSyncing: (() => Promise<void>) | undefined
    try {
      process.stdout.write('\n')

      const root = getRoot(opts.path)
      const config: Pick<DevbookConfig, 'id'> = { id: envID }

      const session = new sdk.Session({
        id: config.id,
      })

      await session.open()

      stopSyncing = await keepEnvironmentInSync({
        root,
        filesystem: session.filesystem,
      })

      await startDevelopment({ session, config })

      process.stdout.write('\n')
      // We explicitly call exit because the session is keeping the program alive.
      // We also don't want to call session.close because that would disconnect other users from the edit session.
      await stopSyncing?.()
      process.exit(0)
    } catch (err: any) {
      console.error(asFormattedError(err.message))
      await stopSyncing?.()
      process.exit(1)
    }
  })

export async function startDevelopment({
  session,
  config,
}: {
  session: sdk.Session
  config: Pick<DevbookConfig, 'id'>
}) {
  if (session.terminal) {
    const { exited } = await spawnConnectedTerminal(
      session.terminal,
      `Terminal connected to environment ${asFormattedEnvironment(
        config,
      )}\nwith session URL ${asBold(`https://${session.getHostname()}`)}`,
      `Disconnecting terminal from environment ${asFormattedEnvironment(config)}`,
    )

    await exited
    console.log(
      `Closing terminal connection to environment ${asFormattedEnvironment(config)}`,
    )
  } else {
    throw new Error('Cannot start terminal - no session')
  }
}

const defaultIgnoredPaths = [
  'node_modules',
  '.venv',
  '.git',
  '__pycache__',
  '.DS_Store',
  '.vscode',
  '.idea',
]

async function ensureDirPath({
  root,
  dirPath,
  filesystem,
}: {
  root: string
  dirPath: string
  filesystem: sdk.FilesystemManager
}) {
  const dirs = dirPath
    .split(path.delimiter)
    .reduce(
      (paths, dirName) => {
        paths.push(path.join(paths[paths.length - 1], dirName))
        return paths
      },
      [root],
    )
    .slice(1)

  for (const dir of dirs) {
    await filesystem.makeDir(dir)
  }
}

export async function keepEnvironmentInSync({
  root,
  filesystem,
}: {
  root: string
  filesystem?: sdk.FilesystemManager
}) {
  if (!filesystem) {
    throw new Error('Session filesystem is not available')
  }

  let ignored = defaultIgnoredPaths

  try {
    const gitignore = await fs.readFile(path.join(root, '.gitignore'), 'utf-8')
    const patterns = parseGitignore(gitignore)
    ignored = (patterns as any).patterns
  } catch (err) {
    console.error(err)
  }

  const initialized = createDeferredPromise()

  const fsStack: (() => Promise<void>)[] = []

  async function processStackItem() {
    const item = fsStack.shift()
    console.log('processing stack item', item)
    if (item) {
      await item()
    }
  }

  const watcher = chokidar
    .watch('.', {
      persistent: true,
      ignored,
      // Upload the initial files (chokidar has option for this)
      ignoreInitial: false,
      followSymlinks: true,
      cwd: root,
      disableGlobbing: false,

      usePolling: false,
      interval: 100,
      binaryInterval: 300,
      alwaysStat: false,
      depth: 99,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100,
      },
      ignorePermissionErrors: false,
      atomic: true, // or a custom 'atomicity delay', in milliseconds (default 100)
    })
    .on('ready', () => {
      console.log('ready')
      initialized.resolve()
    })
    .on('change', async p => {
      console.log('change', p)
      const handleChange = async () => {
        try {
          const content = await fs.readFile(path.join(root, p), 'utf-8')
          await ensureDirPath({ root: rootdir, dirPath: path.dirname(p), filesystem })
          await filesystem.write(path.join(rootdir, p), content)
        } catch (err) {
          console.error(err)
        }
      }
      fsStack.push(handleChange)
      processStackItem()
    })
    .on('add', async p => {
      console.log('add', p)

      const handleAdd = async () => {
        try {
          const content = await fs.readFile(path.join(root, p), 'utf-8')
          await ensureDirPath({ root: rootdir, dirPath: path.dirname(p), filesystem })
          await filesystem.write(path.join(rootdir, p), content)
        } catch (err) {
          console.error(err)
        }
      }
      fsStack.push(handleAdd)
      processStackItem()
    })
    .on('addDir', async p => {
      console.log('addDir', p)
      const handleAddDir = async () => {
        try {
          await ensureDirPath({ root, dirPath: path.dirname(p), filesystem })
          await filesystem.makeDir(path.join(rootdir, p))
        } catch (err) {
          console.error(err)
        }
      }
      fsStack.push(handleAddDir)
      processStackItem()
    })
    .on('unlink', async p => {
      console.log('unlink', p)
      const handleUnlink = async () => {
        try {
          await filesystem.remove(path.join(rootdir, p))
        } catch (err) {
          console.error(err)
        }
      }
      fsStack.push(handleUnlink)
      processStackItem()
    })
    .on('unlinkDir', async p => {
      console.log('unlinkDir', p)
      const handleUnlinkDir = async () => {
        try {
          await filesystem.remove(path.join(rootdir, p))
        } catch (err) {
          console.error(err)
        }
      }
      fsStack.push(handleUnlinkDir)
      processStackItem()
    })

  await initialized.promise

  return () => watcher.close()
}
