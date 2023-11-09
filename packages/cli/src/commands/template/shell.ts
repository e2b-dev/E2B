import * as e2b from '@e2b/sdk'
import * as commander from 'commander'

import { ensureAPIKey } from 'src/api'
import { spawnConnectedTerminal } from 'src/terminal'
import { asBold, asFormattedSandboxTemplate, asPrimary } from 'src/utils/format'
import { getRoot } from '../../utils/filesystem'
import { getConfigPath, loadConfig } from '../../config'
import fs from 'fs'
import { pathOption } from '../../options'
import path from 'path'

export const shellCommand = new commander.Command('shell')
  .description('Connect to the terminal in the sandbox')
  .argument('<id>', `Connect to sandbox specified by ${asPrimary('template id')}`)
  .option(
    '-n, --name <name>',
    'Specify name of sandbox template. You can use the name to start the sandbox in the SDK.',
  )
  .addOption(pathOption)
  .alias('sh')
  .action(async (id: string | undefined, opts: {
    name?: string;
    path?: string;
  }) => {
    try {
      const apiKey = ensureAPIKey()
      let envID = id


      const root = getRoot(opts.path)
      const configPath = getConfigPath(root)

      const config = fs.existsSync(configPath)
        ? await loadConfig(configPath)
        : undefined
      const relativeConfigPath = path.relative(root, configPath)

      if (config) {
        console.log(
          `Found sandbox template ${asFormattedSandboxTemplate(
            {
              envID: config.id,
              aliases: config.name ? [config.name] : undefined,
            },
            relativeConfigPath,
          )}`,
        )
        envID = config.id
      }

      if (!envID) {
        console.error(
          `You need to specify sandbox template ID or path to sandbox template config`,
        )
        process.exit(1)
      }
      const template: Pick<e2b.components['schemas']['Environment'], 'envID'> = { envID: envID }

      await connectSandbox({ apiKey, template: template })
      // We explicitly call exit because the sandbox is keeping the program alive.
      // We also don't want to call sandbox.close because that would disconnect other users from the edit session.
      process.exit(0)
    } catch (err: any) {
      console.error(err)
      process.exit(1)
    }
  })

async function connectSandbox({
    apiKey,
    template,
  }: {
  apiKey: string;
  template: Pick<e2b.components['schemas']['Environment'], 'envID'>;
}) {
  const sandbox = await e2b.Sandbox.create({
    apiKey,
    id: template.envID,
  })

  if (sandbox.terminal) {
    const { exited } = await spawnConnectedTerminal(
      sandbox.terminal,
      `Terminal connected to sandbox ${asFormattedSandboxTemplate(
        template,
      )}\nwith sandbox URL ${asBold(`https://${sandbox.getHostname()}`)}`,
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
