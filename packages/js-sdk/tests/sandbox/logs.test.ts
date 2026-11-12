import { expect } from 'vitest'

import { Sandbox, SandboxLogEntry, SandboxLogsPaginator } from '../../src'
import { sandboxTest, isDebug, wait } from '../setup.js'

async function waitForLogs(
  getLogs: () => SandboxLogsPaginator
): Promise<SandboxLogEntry[]> {
  let logs: SandboxLogEntry[] = []
  for (let i = 0; i < 60; i++) {
    logs = await getLogs().nextItems()
    if (logs.length > 0) {
      break
    }
    await wait(500)
  }
  return logs
}

async function readAll(
  paginator: SandboxLogsPaginator
): Promise<SandboxLogEntry[]> {
  const logs: SandboxLogEntry[] = []
  while (paginator.hasNext) {
    logs.push(...(await paginator.nextItems()))
  }
  return logs
}

const logKey = (log: SandboxLogEntry) =>
  JSON.stringify([log.timestamp.getTime(), log.level, log.message, log.fields])

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
    const all = await waitForLogs(() => Sandbox.getLogs(sandbox.sandboxId))
    expect(all.length).toBeGreaterThan(0)

    const limited = sandbox.getLogs({ limit: 1 })
    expect(await limited.nextItems()).toHaveLength(1)
    expect(limited.hasNext).toBe(true)

    const forward = await sandbox.getLogs({ direction: 'forward' }).nextItems()
    for (let i = 1; i < forward.length; i++) {
      expect(forward[i].timestamp.getTime()).toBeGreaterThanOrEqual(
        forward[i - 1].timestamp.getTime()
      )
    }

    const backward = await sandbox
      .getLogs({ direction: 'backward' })
      .nextItems()
    for (let i = 1; i < backward.length; i++) {
      expect(backward[i].timestamp.getTime()).toBeLessThanOrEqual(
        backward[i - 1].timestamp.getTime()
      )
    }

    const message = forward[0].message
    const searched = await sandbox.getLogs({ search: message }).nextItems()
    expect(searched.length).toBeGreaterThan(0)
    for (const log of searched) {
      expect(log.message).toContain(message)
    }

    const missing = sandbox.getLogs({
      search: 'e2b-sdk-test-no-such-log-line',
    })
    expect(await missing.nextItems()).toHaveLength(0)
    expect(missing.hasNext).toBe(false)

    const errorsOnly = await sandbox.getLogs({ level: 'error' }).nextItems()
    for (const log of errorsOnly) {
      expect(log.level).toBe('error')
    }

    const beforeSandbox = await sandbox
      .getLogs({
        cursor: new Date(Date.now() - 60 * 60 * 1000),
        direction: 'backward',
      })
      .nextItems()
    expect(beforeSandbox).toHaveLength(0)
  }
)

for (const direction of ['forward', 'backward'] as const) {
  sandboxTest.skipIf(isDebug)(
    `sbx logs pagination ${direction}`,
    { timeout: 120_000 },
    async ({ sandbox }) => {
      await waitForLogs(() => sandbox.getLogs())
      await sandbox.commands.run('echo hello')
      await wait(2_000)

      const all = await sandbox.getLogs({ direction }).nextItems()
      const paged = await readAll(sandbox.getLogs({ direction, limit: 2 }))

      const keys = paged.map(logKey)
      expect(new Set(keys).size).toBe(keys.length)
      for (const log of all) {
        expect(keys).toContain(logKey(log))
      }
      for (let i = 1; i < paged.length; i++) {
        const diff =
          paged[i].timestamp.getTime() - paged[i - 1].timestamp.getTime()
        expect(direction === 'forward' ? diff : -diff).toBeGreaterThanOrEqual(0)
      }
    }
  )
}
