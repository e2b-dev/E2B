import * as fs from 'fs'
import * as path from 'path'
import { lock } from 'proper-lockfile'

export type FileLockOptions = {
  /**
   * A lock whose holder hasn't touched it for this long is taken to be left
   * behind by a process that crashed, and is removed. The holder refreshes
   * the lock every `staleMs / 2`, so a live holder is never taken over.
   */
  staleMs: number
  /** How long to wait for another holder before giving up. */
  timeoutMs: number
}

const RETRY_INTERVAL_MS = 100

/**
 * Run `fn` while holding an exclusive lock on `filePath` that all e2b
 * processes on this machine share, and release it afterwards, whether `fn`
 * returns or throws.
 *
 * The lock is `${filePath}.lock`, managed by proper-lockfile: it's created
 * atomically, kept fresh while held, released when the process exits, and
 * taken over once stale. `filePath` itself doesn't have to exist.
 */
export async function withFileLock<T>(
  filePath: string,
  fn: () => T | Promise<T>,
  { staleMs, timeoutMs }: FileLockOptions
): Promise<T> {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 })

  let release: () => Promise<void>
  try {
    release = await lock(filePath, {
      realpath: false,
      stale: staleMs,
      retries: {
        retries: Math.ceil(timeoutMs / RETRY_INTERVAL_MS),
        minTimeout: RETRY_INTERVAL_MS,
        maxTimeout: RETRY_INTERVAL_MS,
        maxRetryTime: timeoutMs,
      },
      // proper-lockfile's default handler throws from a timer, which would
      // take the whole command down. Losing the lock only means another e2b
      // process took it over, so warn and let `fn` finish.
      onCompromised: (err) => {
        console.error(
          `Warning: lost the lock on ${filePath} (${err.message}); another e2b process may have taken it over.`
        )
      },
    })
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ELOCKED') {
      throw new Error(
        `Timed out waiting for another e2b process to release ${filePath}.lock. If none is running, delete it and try again.`
      )
    }
    throw err
  }

  try {
    return await fn()
  } finally {
    await release()
  }
}
