import * as sdk from '@e2b/sdk'
import * as boxen from 'boxen'

import { asBold } from './utils/format'

// @ts-ignore
const client: sdk.ClientType = sdk.api

// client.configure({
//   baseUrl: 'http://localhost:3000',
// })

const apiKey = process.env.DEVBOOK_KEY

export function ensureAPIKey() {
  if (!apiKey) {
    const errorBox = boxen.default(
      `Cannot find env var ${asBold(
        'DEVBOOK_KEY',
      )}\n\nVisit https://dash.usedevbook.com/settings to get your API key then run this CLI with the env var set.`,
      {
        width: 70,
        float: 'center',
        padding: 0.5,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'redBright',
      },
    )
    console.error(errorBox)
    process.exit(1)
  } else {
    return apiKey
  }
}

export { client, apiKey }
