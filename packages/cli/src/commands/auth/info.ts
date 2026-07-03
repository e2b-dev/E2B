import * as commander from 'commander'
import * as e2b from 'e2b'

import { getUserConfig, writeUserConfig, USER_CONFIG_PATH } from 'src/user'
import { Teams } from 'src/api'
import { ensureValidAccessToken } from 'src/utils/token-refresh'
import { asFormattedConfig, asFormattedError } from 'src/utils/format'

export const infoCommand = new commander.Command('info')
  .description('get information about the current user')
  .action(async () => {
    let userConfig
    try {
      userConfig = getUserConfig()
    } catch (err) {
      console.error(asFormattedError('Failed to read user config', err))
    }

    if (!userConfig) {
      console.log('Not logged in')
      return
    }

    // Fetch fresh team name from the API so the displayed info is always
    // up-to-date (handles renamed teams and stale/missing teamName).
    try {
      const accessToken = await ensureValidAccessToken()
      // Re-read config after token refresh so we don't overwrite refreshed tokens
      userConfig = getUserConfig()!
      const config = new e2b.ConnectionConfig({
        apiHeaders: { Authorization: `Bearer ${accessToken}` },
      })
      const client = new e2b.ApiClient(config, { requireApiKey: false })
      const res = await client.api.GET('/teams', {
        signal: config.getSignal(),
      })

      if (res.data) {
        const teams = res.data as Teams
        const selected = teams.find(
          (team) => team.teamID === userConfig!.teamId
        )
        if (selected && selected.name !== userConfig.teamName) {
          userConfig.teamName = selected.name
          writeUserConfig(USER_CONFIG_PATH, userConfig)
        }
      }
    } catch {
      // API unavailable — fall back to cached config
    }

    console.log(asFormattedConfig(userConfig))

    process.exit(0)
  })
