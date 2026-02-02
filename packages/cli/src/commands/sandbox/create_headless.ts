import * as commander from 'commander'
import * as path from 'path'
import * as fs from 'fs'
import * as e2b from 'e2b'

import { ensureAPIKey, getDomain } from 'src/api'
import { asBold, asFormattedSandboxTemplate } from 'src/utils/format'
import { getRoot } from '../../utils/filesystem'
import { getConfigPath, loadConfig } from '../../config'
import { configOption, pathOption } from '../../options'

const DEFAULT_TIMEOUT_MS = 300_000

export const createHeadlessCommand = new commander.Command('create-headless')
  .description(
    'create sandbox without attaching a terminal (prints sandbox ID)'
  )
  .argument(
    '[template]',
    `create sandbox specified by ${asBold('[template]')}`
  )
  .addOption(pathOption)
  .addOption(configOption)
  .option(
    '--timeout-ms <ms>',
    'sandbox timeout in milliseconds (default 300000)',
    (value) => parseInt(value, 10)
  )
  .alias('create_headless')
  .alias('ch')
  .action(
    async (
      template: string | undefined,
      opts: {
        name?: string
        path?: string
        config?: string
        timeoutMs?: number
      }
    ) => {
      try {
        const apiKey = ensureAPIKey()
        const domain = getDomain()
        let templateID = template

        const root = getRoot(opts.path)
        const configPath = getConfigPath(root, opts.config)

        const config = fs.existsSync(configPath)
          ? await loadConfig(configPath)
          : undefined
        const relativeConfigPath = path.relative(root, configPath)

        if (!templateID && config) {
          console.log(
            `Found sandbox template ${asFormattedSandboxTemplate(
              {
                templateID: config.template_id,
                aliases: config.template_name
                  ? [config.template_name]
                  : undefined,
              },
              relativeConfigPath
            )}`
          )
          templateID = config.template_id
        }

        if (!templateID) {
          console.error(
            'You need to specify sandbox template ID or path to sandbox template config'
          )
          process.exit(1)
        }

        const timeoutMs =
          Number.isFinite(opts.timeoutMs) && opts.timeoutMs
            ? opts.timeoutMs
            : DEFAULT_TIMEOUT_MS

        const sandbox = await e2b.Sandbox.create(templateID, {
          apiKey,
          domain,
          timeoutMs,
        })

        console.log(sandbox.sandboxId)
        process.exit(0)
      } catch (err: any) {
        console.error(err)
        process.exit(1)
      }
    }
  )
