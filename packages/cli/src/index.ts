#!/usr/bin/env -S node --enable-source-maps

import simpleUpdateNotifier from 'simple-update-notifier'
import * as commander from 'commander'
import { spawn } from 'node:child_process'
import * as packageJSON from '../package.json'
import { program } from './commands'
import { commands2md } from './utils/commands2md'

export const pkg = packageJSON

const updateCheck = simpleUpdateNotifier({
  pkg,
  updateCheckInterval: 1000 * 60 * 60 * 8, // 8 hours
}).catch((e) => {
  if (process.env.DEBUG) {
    console.error('Update check failed:', e)
  }
})

const prog = program.version(
  packageJSON.version,
  undefined,
  'display E2B CLI version'
)

if (process.env.NODE_ENV === 'development') {
  prog
    .addOption(new commander.Option('-cmd2md').hideHelp())
    .on('option:-cmd2md', () => {
      commands2md(program.commands as any)
      process.exit(0)
    })
}

/**
 * If E2B_ERROR_HANDLER is set, spawn the executable with a structured
 * payload as the first argv entry. The handler must be a path to an
 * executable (not a shell command) — shell expansion is deliberately
 * disabled.
 *
 * Security: `shell: false` prevents command injection via the env var.
 * Privacy: the payload is intentionally limited to non-sensitive fields
 * (schemaVersion, reason, timestamp, pid) to avoid leaking diagnostic
 * details through argv.
 * Lifetime: the handler runs detached and is `unref()`'d; the E2B CLI
 * does not wait for its completion before exiting.
 *
 * Implementation note: this is intentionally a synchronous (non-async)
 * function. The spawn helper is imported at the top of the file (so the
 * specifier is cached and resolved synchronously). The callers invoke
 * runExternalErrorHandler immediately before `process.exit(...)`, so the
 * spawn must be fire-able synchronously — a dynamic `import()` would
 * race with `process.exit(...)` and the handler would never fire.
 */
function runExternalErrorHandler(reason: string): void {
  const handler = process.env.E2B_ERROR_HANDLER?.trim()
  if (!handler) return

  try {
    const child = spawn(handler, [JSON.stringify({
      schemaVersion: 1, reason, timestamp: new Date().toISOString(), pid: process.pid
    })], { env: { PATH: process.env.PATH }, stdio: 'ignore', detached: true, shell: false })
    child.on('error', () => {})
    child.unref()
  } catch {}
}

async function main() {
  try {
    await prog.parseAsync()
    await updateCheck
  } catch (e) {
    console.error(e)
    runExternalErrorHandler('cli_command_failure')
    process.exit(1)
  }
}

main()

// Catch-all for process-wide fatal errors that escape main():
// - unhandledRejection: a rejected promise with no .catch() handler
// - uncaughtException: a synchronous throw outside any try/catch
// Both routes forward to the configured E2B_ERROR_HANDLER (if set)
// and then exit with code 1 so the CLI does not silently hang.
process.on('unhandledRejection', (reason) => {
  runExternalErrorHandler('unhandled_rejection')
  process.exit(1)
})

process.on('uncaughtException', (err) => {
  console.error(err)
  runExternalErrorHandler('uncaught_exception')
  process.exit(1)
})