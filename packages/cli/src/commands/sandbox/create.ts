import * as e2b from 'e2b'
import * as commander from 'commander'
import * as path from 'path'

import { ensureAPIKey } from 'src/api'
import { spawnConnectedTerminal } from 'src/terminal'
import { asBold, asFormattedSandboxTemplate } from 'src/utils/format'
import { getRoot } from '../../utils/filesystem'
import { getConfigPath, loadConfig } from '../../config'
import fs from 'fs'
import { configOption, pathOption } from '../../options'

export function createCommand(
  name: string,
  alias: string,
  deprecated: boolean
) {
  return new commander.Command(name)
    .description('create sandbox and connect terminal to it')
    .argument(
      '[template]',
      `create and connect to sandbox specified by ${asBold('[template]')}`
    )
    .addOption(pathOption)
    .addOption(configOption)
    .alias(alias)
    .action(
      async (
        template: string | undefined,
        opts: {
          name?: string
          path?: string
          config?: string
        }
      ) => {
        if (deprecated) {
          console.warn(
            `Warning: The '${name}' command is deprecated and will be removed in future releases. Please use 'e2b sandbox create' instead.`
          )
        }
        try {
          const apiKey = ensureAPIKey()
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

          await connectSandbox({ apiKey, template: { templateID } })
          process.exit(0)
        } catch (err: any) {
          console.error(err)
          process.exit(1)
        }
      }
    )
}

export async function connectSandbox({
  apiKey,
  template,
}: {
  apiKey: string
  template: Pick<e2b.components['schemas']['Template'], 'templateID'>
}) {
  const sandbox = await e2b.Sandbox.create(template.templateID, { apiKey })

  // keep-alive loop
  const intervalId = setInterval(async () => {
    await sandbox.setTimeout(30_000)
  }, 5_000)

  console.log(
    `Terminal connecting to template ${asFormattedSandboxTemplate(
      template
    )} with sandbox ID ${asBold(`${sandbox.sandboxId}`)}`
  )
  try {
    await spawnConnectedTerminal(sandbox)
  } finally {
    clearInterval(intervalId)
    await sandbox.kill()
    console.log(
      `Closing terminal connection to template ${asFormattedSandboxTemplate(
        template
      )} with sandbox ID ${asBold(`${sandbox.sandboxId}`)}`
    )
  }
}
