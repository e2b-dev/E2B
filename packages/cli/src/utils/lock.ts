import * as fs from 'fs'
import * as path from 'path'

import { wait } from './wait'

export type FileLockOptions = {
  /**
   * A lock file older than this is taken to be left behind by a process that
   * crashed while holding it, and is removed. Must be longer than `fn` can
   * take, or a live holder's lock could be taken over.
   */
  staleMs: number
  /** How long to wait for another holder before giving up. */
  timeoutMs: number
}

const POLL_INTERVAL_MS = 100

/**
 * Run `fn` while holding an exclusive lock that all e2b processes on this
 * machine share, and release it afterwards, whether `fn` returns or throws.
 *
 * The lock is a file created with `O_EXCL` at `lockPath`: whoever creates it
 * holds the lock, and the others poll until it's gone.
 */
export async function withFileLock<T>(
  lockPath: string,
  fn: () => T | Promise<T>,
  { staleMs, timeoutMs }: FileLockOptions
): Promise<T> {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true, mode: 0o700 })
  const deadline = Date.now() + timeoutMs

  for (;;) {
    try {
      fs.closeSync(fs.openSync(lockPath, 'wx', 0o600))
      break
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
    }

    const lockAgeMs =
      Date.now() -
      (fs.statSync(lockPath, { throwIfNoEntry: false })?.mtimeMs ?? Date.now())
    if (lockAgeMs > staleMs) {
      fs.rmSync(lockPath, { force: true })
      continue
    }
    if (Date.now() > deadline) {
      throw new Error(
        `Timed out waiting for another e2b process to release ${lockPath}. If none is running, delete it and try again.`
      )
    }
    await wait(POLL_INTERVAL_MS)
  }

  try {
    return await fn()
  } finally {
    fs.rmSync(lockPath, { force: true })
  }
}
