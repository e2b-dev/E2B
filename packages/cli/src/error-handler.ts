/**
 * External fatal-error routing for the E2B CLI.
 *
 * If `E2B_ERROR_HANDLER` is set, spawn the configured executable with a
 * structured payload as the first argv entry. The handler must be a path
 * to an executable (not a shell command) — shell expansion is deliberately
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
import { spawn } from 'node:child_process'

export function runExternalErrorHandler(reason: string): void {
  const handler = process.env.E2B_ERROR_HANDLER?.trim()
  if (!handler) return

  try {
    const child = spawn(
      handler,
      [
        JSON.stringify({
          schemaVersion: 1,
          reason,
          timestamp: new Date().toISOString(),
          pid: process.pid,
        }),
      ],
      {
        env: { PATH: process.env.PATH },
        stdio: 'ignore',
        detached: true,
        shell: false,
      },
    )
    child.on('error', () => {})
    child.unref()
  } catch {}
}