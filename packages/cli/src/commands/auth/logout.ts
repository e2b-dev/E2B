import * as commander from 'commander'
import * as fs from 'fs'

import { getUserConfig, USER_CONFIG_PATH } from 'src/user'

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
    if (config) {
      const revokeEndpoint = config.oauth.token_endpoint.replace(
        '/token',
        '/revoke'
      )
      await fetch(revokeEndpoint, {
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
