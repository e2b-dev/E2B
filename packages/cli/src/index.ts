#!/usr/bin/env -S node --enable-source-maps

import { select } from '@inquirer/prompts'
import * as commander from 'commander'
import * as fs from 'fs'
import * as packageJSON from '../package.json'
import { program } from './commands'
import { commands2md } from './utils/commands2md'
import {
  detectInstallMethod,
  getUpdateCachePath,
  getUpdateCommandDisplay,
  isNewer,
  isUpdateCacheStale,
  readUpdateCache,
  refreshUpdateCache,
  runUpdateCommand,
  shouldPrompt,
  writeUpdateCache,
} from './utils/updater'

export const pkg = packageJSON

// NO_UPDATE_NOTIFIER is the opt-out shared with `update-notifier`; distro
// packagers set it because "install the new version" doesn't apply there.
const UPDATE_CHANGELOG_URL =
  'https://github.com/e2b-dev/E2B/blob/main/packages/cli/CHANGELOG.md'

const prog = program.version(
  packageJSON.version,
  undefined,
  'display E2B CLI version'
)

if (process.env.NODE_ENV === 'development') {
  prog
    .addOption(new commander.Option('-cmd2md').hideHelp())
    .on('option:-cmd2md', () => {
      commands2md(program.commands as any)
      process.exit(0)
    })
}

interface StartupUpdateResult {
  updateCheck: Promise<unknown>
  skipCommand: boolean
  exitCode?: number
  warning?: string
}

function getCurrentInstallMethod(): ReturnType<typeof detectInstallMethod> {
  try {
    return detectInstallMethod(fs.realpathSync(process.argv[1]))
  } catch {
    return 'other'
  }
}

function isUpdaterDisabled(): boolean {
  return (
    process.env.NO_UPDATE_NOTIFIER !== undefined ||
    process.env.CI !== undefined ||
    process.env.NODE_ENV === 'development'
  )
}

async function startStartupUpdate(): Promise<StartupUpdateResult> {
  if (isUpdaterDisabled()) {
    return { updateCheck: Promise.resolve(), skipCommand: false }
  }

  const method = getCurrentInstallMethod()
  const cachePath = getUpdateCachePath()
  const cachedUpdate = readUpdateCache(cachePath)
  const updateCheck = isUpdateCacheStale(cachedUpdate)
    ? refreshUpdateCache(method, { cachePath })
    : Promise.resolve(undefined)
  const latestVersion = cachedUpdate?.latestVersion

  let prompted = false
  let skipCommand = false
  let exitCode: number | undefined

  if (
    latestVersion &&
    shouldPrompt({
      currentVersion: packageJSON.version,
      latestVersion,
      method,
      dismissedVersion: cachedUpdate.dismissedVersion,
    })
  ) {
    prompted = true
    console.log(UPDATE_CHANGELOG_URL)

    let answer: 'update' | 'skip' | 'dismiss' = 'skip'
    try {
      answer = await select({
        message: `Update available! ${packageJSON.version} -> ${latestVersion}`,
        choices: [
          {
            name: `Update now (runs \`${getUpdateCommandDisplay(method)}\`)`,
            value: 'update',
          },
          { name: 'Skip', value: 'skip' },
          { name: 'Skip until next version', value: 'dismiss' },
        ],
      })
    } catch (error) {
      if (!(error instanceof Error && error.name === 'ExitPromptError')) {
        if (process.env.DEBUG) {
          console.error('Update prompt failed:', error)
        }
      }
    }

    if (answer === 'update') {
      skipCommand = true
      const code = await runUpdateCommand(method)
      if (code === 0) {
        console.log(
          `Updated E2B CLI to ${latestVersion}. Run your command again.`
        )
      } else {
        console.error(
          `Update failed. Run \`${getUpdateCommandDisplay(method)}\` to update manually.`
        )
      }
      exitCode = code ?? 1
    } else if (answer === 'dismiss') {
      writeUpdateCache(
        { ...cachedUpdate, dismissedVersion: latestVersion },
        cachePath
      )
    }
  }

  let warning: string | undefined
  if (
    !prompted &&
    latestVersion &&
    isNewer(latestVersion, packageJSON.version) &&
    latestVersion !== cachedUpdate?.dismissedVersion &&
    process.stderr.isTTY
  ) {
    const command = getUpdateCommandDisplay(method)
    warning = command
      ? `Update available: ${packageJSON.version} -> ${latestVersion}. Run \`${command}\` to update.`
      : `Update available: ${packageJSON.version} -> ${latestVersion}. Update @e2b/cli with your package manager.`
  }

  return { updateCheck, skipCommand, exitCode, warning }
}

async function main() {
  const startupUpdate = await startStartupUpdate()
  if (startupUpdate.warning) {
    process.once('exit', () => {
      process.stderr.write(`${startupUpdate.warning}\n`)
    })
  }
  if (!startupUpdate.skipCommand) {
    await prog.parseAsync()
  }
  await startupUpdate.updateCheck
  if (startupUpdate.exitCode !== undefined) {
    process.exitCode = startupUpdate.exitCode
  }
}

main()
