import * as commander from 'commander'
import * as fs from 'fs'
import * as packageJSON from '../../package.json'
import {
  detectInstallMethod,
  fetchLatestVersion,
  getUpdateCommandDisplay,
  isNewer,
  runUpdateCommand,
  writeUpdateCache,
} from '../utils/updater'

export const updateCommand = new commander.Command('update')
  .description('update E2B CLI to the latest version')
  .action(async () => {
    let method: ReturnType<typeof detectInstallMethod> = 'other'
    try {
      method = detectInstallMethod(fs.realpathSync(process.argv[1]))
    } catch {
      // Leave the install method as unknown if the executable path is unavailable.
    }

    let latestVersion: string
    try {
      latestVersion = await fetchLatestVersion(method)
    } catch (error) {
      console.error('Failed to fetch the latest E2B CLI version:', error)
      process.exitCode = 1
      return
    }

    writeUpdateCache({
      lastCheckedAt: new Date().toISOString(),
      latestVersion,
    })

    const command = getUpdateCommandDisplay(method)
    if (!command) {
      console.error(
        "Couldn't detect how E2B CLI was installed. For example, run `npm install -g @e2b/cli@latest`."
      )
      process.exitCode = 1
      return
    }

    if (!isNewer(latestVersion, packageJSON.version)) {
      console.log(`E2B CLI is up to date (${packageJSON.version})`)
      return
    }

    const code = await runUpdateCommand(method)
    if (code === 0) {
      console.log(
        `Updated E2B CLI to ${latestVersion}. Run your command again.`
      )
    } else {
      console.error(`Update failed. Run \`${command}\` to update manually.`)
    }
    process.exitCode = code ?? 1
  })
