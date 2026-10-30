import { expect } from 'vitest'

import { Sandbox, type SandboxEvent } from '../../src'
import { isDebug, sandboxTest, wait } from '../setup.js'

const createdEventType = 'sandbox.lifecycle.created'

sandboxTest.skipIf(isDebug)(
  'sandbox events',
  { timeout: 60_000 },
  async ({ sandbox }) => {
    let events: SandboxEvent[] = []
    for (let i = 0; i < 60; i++) {
      events = await sandbox.getEvents()
      if (events.some((event) => event.type === createdEventType)) {
        break
      }
      await wait(500)
    }

    const event = events.find((event) => event.type === createdEventType)
    expect(event).toBeDefined()
    if (!event) {
      return
    }

    expect(event.sandboxId).toBe(sandbox.sandboxId)
    expect(event.timestamp).toBeInstanceOf(Date)
    for (const value of [
      event.id,
      event.version,
      event.sandboxExecutionId,
      event.sandboxTemplateId,
      event.sandboxBuildId,
      event.sandboxTeamId,
    ]) {
      expect(value).toEqual(expect.any(String))
      expect(value.length).toBeGreaterThan(0)
    }

    const filteredEvents = await Sandbox.getEvents(sandbox.sandboxId, {
      types: [createdEventType],
      limit: 1,
      orderAsc: true,
    })
    expect(filteredEvents).toHaveLength(1)
    expect(filteredEvents[0].type).toBe(createdEventType)
  }
)

sandboxTest.skipIf(isDebug)('unknown sandbox events', async () => {
  const events = await Sandbox.getEvents(`missing-${crypto.randomUUID()}`)
  expect(events).toEqual([])
})
