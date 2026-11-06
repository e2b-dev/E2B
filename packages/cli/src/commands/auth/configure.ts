import * as commander from '@commander-js/extra-typings'

import { getMe } from 'src/api'
import { getConfigRefreshTimestamp, getUserConfig } from 'src/user'
import { updateUserConfig } from 'src/utils/token-refresh'
import { blockedWarning, pickProject } from 'src/workspaces'
import { asBold, asFormattedError } from '../../utils/format'

export const configureCommand = new commander.Command('configure')
  .description('configure user')
  .action(async () => {
    console.log('Configuring user...\n')

    // A file that exists but fails validation counts as signed out too —
    // getUserConfig returns null for it (and prints the deprecation message).
    const userConfig = getUserConfig()
    if (!userConfig) {
      console.log('No user config found, run `e2b auth login` to log in first.')
      return
    }

    try {
      const selected = await pickProject(await getMe(), {
        message: 'Select project',
        selectedId: userConfig.projectId,
      })
      const warning = blockedWarning(selected)
      if (warning) console.warn(warning)

      // Under the refresh lock: another e2b process may refresh (and so
      // rotate) the tokens while the prompt is open.
      await updateUserConfig({
        projectName: selected.project.name,
        projectId: selected.project.id,
        projectDomain: selected.project.control_plane_domain,
        last_refresh: getConfigRefreshTimestamp(),
      })

      console.log(
        `Project ${asBold(selected.project.name)} (${selected.project.public_id}) selected.\n`
      )
    } catch (err) {
      console.error(
        asFormattedError(err instanceof Error ? err.message : String(err))
      )
      process.exit(1)
    }
  })
