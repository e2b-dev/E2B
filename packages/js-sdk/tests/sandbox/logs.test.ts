import { expect } from 'vitest'

import { Sandbox, SandboxLogEntry } from '../../src'
import { sandboxTest, isDebug, wait } from '../setup.js'

async function waitForLogs(
  getLogs: () => Promise<SandboxLogEntry[]>
): Promise<SandboxLogEntry[]> {
  let logs: SandboxLogEntry[] = []
  for (let i = 0; i < 60; i++) {
    logs = await getLogs()
    if (logs.length > 0) {
      break
    }
    await wait(500)
  }
  return logs
}

sandboxTest.skipIf(isDebug)(
  'sbx logs',
  { timeout: 60_000 },
  async ({ sandbox }) => {
    const logs = await waitForLogs(() => sandbox.getLogs())

    expect(logs.length).toBeGreaterThan(0)
    const log = logs[0]
    expect(log.timestamp).toBeInstanceOf(Date)
    expect(['debug', 'info', 'warn', 'error']).toContain(log.level)
    expect(typeof log.message).toBe('string')
    expect(log.fields).toBeTypeOf('object')
  }
)

sandboxTest.skipIf(isDebug)(
  'sbx logs options',
  { timeout: 60_000 },
  async ({ sandbox }) => {
    const all = await waitForLogs(() =>
      Sandbox.getLogs(sandbox.sandboxId, { limit: 2 })
    )
    expect(all.length).toBeGreaterThan(0)

    const limited = await sandbox.getLogs({ limit: 1 })
    expect(limited).toHaveLength(1)

    const forward = await sandbox.getLogs({ direction: 'forward' })
    for (let i = 1; i < forward.length; i++) {
      expect(forward[i].timestamp.getTime()).toBeGreaterThanOrEqual(
        forward[i - 1].timestamp.getTime()
      )
    }

    const backward = await sandbox.getLogs({ direction: 'backward' })
    for (let i = 1; i < backward.length; i++) {
      expect(backward[i].timestamp.getTime()).toBeLessThanOrEqual(
        backward[i - 1].timestamp.getTime()
      )
    }

    const message = forward[0].message
    const searched = await sandbox.getLogs({ search: message })
    expect(searched.length).toBeGreaterThan(0)
    for (const log of searched) {
      expect(log.message).toContain(message)
    }

    const missing = await sandbox.getLogs({
      search: 'e2b-sdk-test-no-such-log-line',
    })
    expect(missing).toHaveLength(0)

    const errorsOnly = await sandbox.getLogs({ level: 'error' })
    for (const log of errorsOnly) {
      expect(log.level).toBe('error')
    }

    const beforeSandbox = await sandbox.getLogs({
      cursor: new Date(Date.now() - 60 * 60 * 1000),
      direction: 'backward',
    })
    expect(beforeSandbox).toHaveLength(0)
  }
)
