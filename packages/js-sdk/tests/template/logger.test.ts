import { expect, test, describe } from 'vitest'
import { LogEntry } from '../../src/template/logger'

describe('LogEntry', () => {
  test('strips ANSI escape codes from the message', () => {
    const entry = new LogEntry(
      new Date('2025-01-01T00:00:00.000Z'),
      'info',
      '\u001b[31mred text\u001b[0m'
    )

    expect(entry.message).toBe('red text')
  })

  test('keeps plain messages unchanged', () => {
    const entry = new LogEntry(
      new Date('2025-01-01T00:00:00.000Z'),
      'info',
      'plain message'
    )

    expect(entry.message).toBe('plain message')
    expect(entry.toString()).toBe(
      '[2025-01-01T00:00:00.000Z] [info] plain message'
    )
  })
})
