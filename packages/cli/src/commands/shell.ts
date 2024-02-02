import * as e2b from 'e2b'
import * as commander from 'commander'
import * as path from 'path'

import { ensureAPIKey } from 'src/api'
import { spawnConnectedTerminal } from 'src/terminal'
import { asBold, asFormattedSandboxTemplate } from 'src/utils/format'
import { getRoot } from '../utils/filesystem'
import { getConfigPath, loadConfig } from '../config'
import fs from 'fs'
import { pathOption } from '../options'

export const shellCommand = new commander.Command('shell')
  .description('Connect terminal to sandbox')
  .argument('[template]', `Connect to sandbox specified by ${asBold('[template]')}`)
  .addOption(pathOption)
  .alias('sh')
  .action(async (template: string | undefined, opts: {
    name?: string;
    path?: string;
  }) => {
    try {
      const apiKey = ensureAPIKey()
      let templateID = template

      const root = getRoot(opts.path)
      const configPath = getConfigPath(root)

      const config = fs.existsSync(configPath)
        ? await loadConfig(configPath)
        : undefined
      const relativeConfigPath = path.relative(root, configPath)

      if (!templateID && config) {
        console.log(
          `Found sandbox template ${asFormattedSandboxTemplate(
            {
              templateID: config.template_id,
              aliases: config.template_name ? [config.template_name] : undefined,
            },
            relativeConfigPath,
          )}`,
        )
        templateID = config.template_id
      }

      if (!templateID) {
        console.error(
          `You need to specify sandbox template ID or path to sandbox template config`,
        )
        process.exit(1)
      }

      await connectSandbox({ apiKey, template: { templateID } })
      // We explicitly call exit because the sandbox is keeping the program alive.
      // We also don't want to call sandbox.close because that would disconnect other users from the edit session.
      process.exit(0)
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })

export async function connectSandbox({
  apiKey,
  template,
}: {
  apiKey: string;
  template: Pick<e2b.components['schemas']['Template'], 'templateID'>;
}) {
  const sandbox = await e2b.Sandbox.create({
    apiKey,
    template: template.templateID,
  })

  if (sandbox.terminal) {
    const { exited } = await spawnConnectedTerminal(
      sandbox.terminal,
      `Terminal connected to sandbox ${asFormattedSandboxTemplate(
        template,
      )}\nwith sandbox URL ${asBold(`${sandbox.getProtocol()}://${sandbox.getHostname()}`)}`,
      `Disconnecting terminal from sandbox ${asFormattedSandboxTemplate(
        template,
      )}`,
    )

    await exited
    console.log(
      `Closing terminal connection to sandbox ${asFormattedSandboxTemplate(
        template,
      )}`,
    )
  } else {
    throw new Error('Cannot start terminal - no sandbox')
  }
}
