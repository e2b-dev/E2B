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
import { printDashboardSandboxInspectUrl } from 'src/utils/urls'

type SandboxLifecycle = {
  onTimeout: 'pause' | 'kill'
  autoResume?: boolean
}

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
    .option('-d, --detach', 'create sandbox without connecting terminal to it')
    .option(
      '--lifecycle <json>',
      'sandbox lifecycle JSON, eg. {"onTimeout":"pause","autoResume":true}',
      parseLifecycle
    )
    .option('--timeout <seconds>', 'sandbox timeout in seconds', parseTimeout)
    .alias(alias)
    .action(
      async (
        template: string | undefined,
        opts: {
          name?: string
          path?: string
          config?: string
          detach?: boolean
          lifecycle?: SandboxLifecycle
          timeout?: number
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
            templateID = 'base'
          }

          const sandboxOpts = {
            apiKey,
            ...(opts.lifecycle ? { lifecycle: opts.lifecycle } : {}),
            ...(opts.timeout !== undefined ? { timeoutMs: opts.timeout } : {}),
          }
          const sandbox = await e2b.Sandbox.create(templateID, sandboxOpts)
          printDashboardSandboxInspectUrl(sandbox.sandboxId)

          if (!opts.detach) {
            await connectSandbox({
              sandbox,
              template: { templateID },
              timeoutMs: opts.timeout,
            })
          } else {
            console.log(
              `Sandbox created with ID ${sandbox.sandboxId} using template ${templateID}`
            )
          }
          process.exit(0)
        } catch (err: any) {
          console.error(err)
          process.exit(1)
        }
      }
    )
}

function parseTimeout(timeoutRaw: string): number {
  const timeoutSeconds = Number(timeoutRaw)
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    throw new commander.InvalidArgumentError(
      '--timeout must be a positive number of seconds'
    )
  }

  return Math.floor(timeoutSeconds * 1000)
}

function parseLifecycle(lifecycleRaw: string): SandboxLifecycle {
  let lifecycle: unknown
  try {
    lifecycle = JSON.parse(lifecycleRaw)
  } catch {
    throw new commander.InvalidArgumentError(
      '--lifecycle must be valid JSON, eg. {"onTimeout":"pause","autoResume":true}'
    )
  }

  if (!lifecycle || typeof lifecycle !== 'object' || Array.isArray(lifecycle)) {
    throw new commander.InvalidArgumentError(
      '--lifecycle must be a JSON object'
    )
  }

  const parsed = lifecycle as Record<string, unknown>
  if (parsed.onTimeout !== 'pause' && parsed.onTimeout !== 'kill') {
    throw new commander.InvalidArgumentError(
      '--lifecycle onTimeout must be "pause" or "kill"'
    )
  }

  if (
    parsed.autoResume !== undefined &&
    typeof parsed.autoResume !== 'boolean'
  ) {
    throw new commander.InvalidArgumentError(
      '--lifecycle autoResume must be a boolean'
    )
  }

  if (parsed.autoResume === true && parsed.onTimeout !== 'pause') {
    throw new commander.InvalidArgumentError(
      '--lifecycle autoResume requires onTimeout="pause"'
    )
  }

  return {
    onTimeout: parsed.onTimeout,
    ...(parsed.autoResume !== undefined
      ? { autoResume: parsed.autoResume }
      : {}),
  }
}

export async function connectSandbox({
  sandbox,
  template,
  timeoutMs,
}: {
  sandbox: e2b.Sandbox
  template: Pick<e2b.components['schemas']['Template'], 'templateID'>
  timeoutMs?: number
}) {
  // keep-alive loop — track the in-flight promise so we can await it on shutdown
  let pendingKeepAlive: Promise<void> = Promise.resolve()
  const keepAliveTimeoutMs = timeoutMs ?? 30_000
  const intervalId = setInterval(() => {
    pendingKeepAlive = sandbox.setTimeout(keepAliveTimeoutMs)
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
    await pendingKeepAlive.catch(() => {})
    await sandbox.setTimeout(timeoutMs ?? 1_000)
    console.log(
      `Closing terminal connection to template ${asFormattedSandboxTemplate(
        template
      )} with sandbox ID ${asBold(`${sandbox.sandboxId}`)}`
    )
  }
}
