import * as commander from 'commander'
import * as e2b from '@e2b/sdk'

import { ensureAccessToken } from 'src/api'
import { asDim } from 'src/utils/format'

const listTemplates = e2b.withAccessToken(
  e2b.api.path('/envs').method('get').create(),
)

export const listCommand = new commander.Command('list')
  .description('List sandbox templates')
  .alias('ls')
  .action(async () => {
    try {
      const accessToken = ensureAccessToken()
      process.stdout.write('\n')

      const templatesResponse = await listTemplates(accessToken, {})

      console.log(asHeadline('Sandbox templates:'))

      const templates = templatesResponse.data

      if (!templates?.length) {
        console.log(`No templates found.\n
You can create a template by running ${asPrimary('e2b template build')} or visit E2B docs ${asPrimary('(https://e2b.dev/docs/guide/custom-sandbox)')} to learn more.`)
      } else {
        templates
          .sort((a, b) => a.envID.localeCompare(b.envID))
          .forEach(template => {
            if (template.aliases?.length) {
              console.log(`${template.aliases?.join(', ')} (${asDim(template.envID)})`)
            } else {
              console.log(`${template.envID}`)
            }
          })
      }

      process.stdout.write('\n')
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })
