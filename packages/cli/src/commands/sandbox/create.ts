import * as e2b from 'e2b'
import * as commander from 'commander'
import * as path from 'path'

import { ensureAPIKey } from 'src/api'
import { spawnConnectedTerminal, TerminalOpts } from 'src/terminal'
import { asBold, asFormattedSandboxTemplate } from 'src/utils/format'
import { getRoot } from '../../utils/filesystem'
import { getConfigPath, loadConfig } from '../../config'
import fs from 'fs'
import { configOption, pathOption } from '../../options'
import { parseEnv } from '../../utils/env'
import { printDashboardSandboxInspectUrl } from 'src/utils/urls'

type SandboxLifecycle = {
  onTimeout: 'pause' | 'kill'
  autoResume?: boolean
}

const MIN_TIMEOUT_MS = 30_000

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
      '--lifecycle.ontimeout <action>',
      'action when sandbox timeout is reached: pause or kill',
      parseOnTimeout
    )
    .option(
      '--lifecycle.autoresume',
      'enable sandbox auto-resume, requires --lifecycle.ontimeout pause'
    )
    .option('--timeout <seconds>', 'sandbox timeout in seconds', parseTimeout)
    .option('-u, --user <user>', 'user to start the terminal session as')
    .option('-c, --cwd <dir>', 'working directory for the terminal session')
    .option(
      '-e, --env <KEY=VALUE>',
      'set environment variable for the terminal session (repeatable)',
      parseEnv,
      {} as Record<string, string>
    )
    .alias(alias)
    .action(
      async (
        template: string | undefined,
        opts: {
          name?: string
          path?: string
          config?: string
          detach?: boolean
          'lifecycle.ontimeout'?: SandboxLifecycle['onTimeout']
          'lifecycle.autoresume'?: boolean
          timeout?: number
          user?: string
          cwd?: string
          env?: Record<string, string>
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

          const lifecycle = buildLifecycle(
            opts['lifecycle.ontimeout'],
            opts['lifecycle.autoresume']
          )
          const sandboxOpts = {
            apiKey,
            ...(lifecycle ? { lifecycle } : {}),
            ...(opts.timeout !== undefined ? { timeoutMs: opts.timeout } : {}),
          }
          const sandbox = await e2b.Sandbox.create(templateID, sandboxOpts)
          printDashboardSandboxInspectUrl(sandbox.sandboxId)

          if (!opts.detach) {
            await connectSandbox({
              sandbox,
              template: { templateID },
              timeoutMs: opts.timeout,
              terminal: {
                user: opts.user,
                cwd: opts.cwd,
                envs:
                  opts.env && Object.keys(opts.env).length > 0
                    ? opts.env
                    : undefined,
              },
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
  const timeoutMs = Math.floor(timeoutSeconds * 1000)
  if (
    !Number.isFinite(timeoutSeconds) ||
    timeoutSeconds <= 0 ||
    timeoutMs < MIN_TIMEOUT_MS
  ) {
    throw new commander.InvalidArgumentError(
      '--timeout must be at least 30 seconds'
    )
  }

  return timeoutMs
}

function parseOnTimeout(onTimeout: string): SandboxLifecycle['onTimeout'] {
  if (onTimeout !== 'pause' && onTimeout !== 'kill') {
    throw new commander.InvalidArgumentError(
      '--lifecycle.ontimeout must be "pause" or "kill"'
    )
  }

  return onTimeout
}

function buildLifecycle(
  onTimeout: SandboxLifecycle['onTimeout'] | undefined,
  autoResume: boolean | undefined
): SandboxLifecycle | undefined {
  if (!onTimeout && !autoResume) {
    return undefined
  }

  if (autoResume && onTimeout !== 'pause') {
    throw new commander.InvalidArgumentError(
      '--lifecycle.autoresume requires --lifecycle.ontimeout pause'
    )
  }

  if (!onTimeout) {
    throw new commander.InvalidArgumentError(
      '--lifecycle.ontimeout is required when using --lifecycle.autoresume'
    )
  }

  return { onTimeout, ...(autoResume ? { autoResume: true } : {}) }
}

export async function connectSandbox({
  sandbox,
  template,
  timeoutMs,
  terminal,
}: {
  sandbox: e2b.Sandbox
  template: Pick<e2b.components['schemas']['Template'], 'templateID'>
  timeoutMs?: number
  terminal?: TerminalOpts
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
    await spawnConnectedTerminal(sandbox, terminal)
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
