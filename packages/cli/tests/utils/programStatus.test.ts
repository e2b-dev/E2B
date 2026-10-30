import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import {
  formatProgramStatus,
  reportProgramStatus,
  whileBlocked,
} from '../../src/utils/programStatus'

const b64 = (text: string) => Buffer.from(text, 'utf8').toString('base64')
const decodeMsg = (report: string) =>
  Buffer.from(/msg=([^:\x1b]*)/.exec(report)![1], 'base64').toString('utf8')

describe('formatProgramStatus', () => {
  test('formats a report with app and base64 msg', () => {
    expect(formatProgramStatus('working', { msg: 'Building template x' })).toBe(
      `\x1b]7501;state=working:app=e2b:msg=${b64('Building template x')}\x1b\\`
    )
  })

  test('includes kind only for blocked', () => {
    expect(
      formatProgramStatus('blocked', { kind: 'auth', msg: 'Log in' })
    ).toBe(
      `\x1b]7501;state=blocked:app=e2b:kind=auth:msg=${b64('Log in')}\x1b\\`
    )
    expect(formatProgramStatus('done', { kind: 'auth' })).toBe(
      '\x1b]7501;state=done:app=e2b\x1b\\'
    )
  })

  test('clear carries only the state', () => {
    expect(formatProgramStatus('clear', { msg: 'ignored' })).toBe(
      '\x1b]7501;state=clear\x1b\\'
    )
  })

  test('replaces control characters in msg', () => {
    const report = formatProgramStatus('blocked', {
      kind: 'permission',
      msg: 'Delete?\n\x1b[31mThis is permanent\t\u0085',
    })
    expect(decodeMsg(report)).toBe('Delete? [31mThis is permanent')
  })

  test('truncates msg to 2048 bytes on a character boundary', () => {
    const report = formatProgramStatus('error', { msg: 'é'.repeat(2000) })
    const msg = decodeMsg(report)
    expect(Buffer.byteLength(msg)).toBe(2048)
    expect(msg).toBe('é'.repeat(1024))
    expect(report.length).toBeLessThanOrEqual(4096)
  })
})

describe('reportProgramStatus', () => {
  const stdoutTTY = process.stdout.isTTY
  const stderrTTY = process.stderr.isTTY
  let stdoutWrite: ReturnType<typeof vi.spyOn>
  let stderrWrite: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    stdoutWrite = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    stderrWrite = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
  })

  afterEach(() => {
    process.stdout.isTTY = stdoutTTY
    process.stderr.isTTY = stderrTTY
    vi.restoreAllMocks()
  })

  test('writes to stdout when it is a terminal', () => {
    process.stdout.isTTY = true
    process.stderr.isTTY = true
    reportProgramStatus('done')
    expect(stdoutWrite).toHaveBeenCalledWith(
      '\x1b]7501;state=done:app=e2b\x1b\\'
    )
    expect(stderrWrite).not.toHaveBeenCalled()
  })

  test('falls back to stderr when stdout is piped', () => {
    process.stdout.isTTY = false
    process.stderr.isTTY = true
    reportProgramStatus('done')
    expect(stdoutWrite).not.toHaveBeenCalled()
    expect(stderrWrite).toHaveBeenCalledWith(
      '\x1b]7501;state=done:app=e2b\x1b\\'
    )
  })

  test('writes nothing when no stream is a terminal', () => {
    process.stdout.isTTY = false
    process.stderr.isTTY = false
    reportProgramStatus('done')
    expect(stdoutWrite).not.toHaveBeenCalled()
    expect(stderrWrite).not.toHaveBeenCalled()
  })

  test('whileBlocked clears the record after the wait, even on failure', async () => {
    process.stdout.isTTY = true
    await expect(
      whileBlocked('question', 'Pick one', async () => {
        throw new Error('aborted')
      })
    ).rejects.toThrow('aborted')
    expect(
      (stdoutWrite.mock.calls as unknown as [string][]).map(([data]) => data)
    ).toEqual([
      `\x1b]7501;state=blocked:app=e2b:kind=question:msg=${b64('Pick one')}\x1b\\`,
      '\x1b]7501;state=clear\x1b\\',
    ])
  })
})
