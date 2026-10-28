import * as commander from 'commander'
import * as fs from 'fs'

import { deleteApiKey } from 'src/projects'
import { getUserConfig, USER_CONFIG_PATH } from 'src/user'
import { ensureValidAccessToken } from 'src/utils/token-refresh'

export const logoutCommand = new commander.Command('logout')
  .description('log out of CLI')
  .action(async () => {
    if (!fs.existsSync(USER_CONFIG_PATH)) {
      console.log('Not logged in, nothing to do')
      return
    }

    let config
    try {
      config = getUserConfig()
    } catch {
      // Malformed config file — proceed to delete it below
    }
    // Before the refresh token is revoked: deleting the key needs a valid
    // access token, which may have to be refreshed first.
    if (config?.version === 3) {
      try {
        await deleteApiKey(await ensureValidAccessToken(), config)
      } catch (err) {
        console.warn(`Could not delete the CLI's API key: ${err}`)
      }
    }

    if (config) {
      await fetch(config.oauth.revoke_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          token: config.tokens.refresh_token,
          token_type_hint: 'refresh_token',
          client_id: config.oauth.client_id,
        }),
      }).catch(() => {})
    }

    if (fs.existsSync(USER_CONFIG_PATH)) {
      fs.unlinkSync(USER_CONFIG_PATH)
    }
    console.log('Logged out.')
  })
