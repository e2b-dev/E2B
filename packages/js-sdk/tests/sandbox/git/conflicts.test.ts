import { afterEach, expect, test, vi } from 'vitest'

import { Sandbox } from '../../../src'

afterEach(() => vi.unstubAllGlobals())

function envelope(value: unknown, flag = 0): Uint8Array {
  const data = new TextEncoder().encode(JSON.stringify(value))
  const frame = new Uint8Array(5 + data.length)
  frame[0] = flag
  new DataView(frame.buffer).setUint32(1, data.length)
  frame.set(data, 5)
  return frame
}

async function sandboxWithOutput(output: string): Promise<Sandbox> {
  const frames = [
    envelope({ event: { start: { pid: 42 } } }),
    envelope({ event: { data: { stdout: btoa(output) } } }),
    envelope({
      event: { end: { exitCode: 0, exited: true, status: 'exited' } },
    }),
    envelope({}, 2),
  ]
  const body = new Uint8Array(
    frames.reduce((length, frame) => length + frame.length, 0)
  )
  let offset = 0
  for (const frame of frames) {
    body.set(frame, offset)
    offset += frame.length
  }
  // Process RPC response fixture; Commands, command handles and Git stay real.
  vi.stubGlobal('fetch', async (_url: unknown, options: RequestInit) => {
    await new Response(options.body).arrayBuffer()
    return new Response(body, {
      headers: { 'Content-Type': 'application/connect+json' },
    })
  })
  return Sandbox.connect('offline-sandbox', { debug: true })
}

// The seven unmerged codes documented by git-status; also verified with real
// index stages and git status --porcelain=1 in the local reproduction.
test.each(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'])(
  'git status reports %s as an unresolved conflict',
  async (code) => {
    const sandbox = await sandboxWithOutput(`## main\n${code} conflict.txt\n`)
    const status = await sandbox.git.status('/repo')
    expect(status.fileStatus[0]?.status).toBe('conflict')
    expect(status.hasConflicts).toBe(true)
    expect(status.conflictCount).toBe(1)
    expect(status.totalCount).toBe(1)
  }
)

test.each([
  ['A ', 'added'],
  [' D', 'deleted'],
  ['AM', 'added'],
  ['MD', 'deleted'],
  ['??', 'untracked'],
])('git status keeps ordinary %s changes as %s', async (code, expected) => {
  const sandbox = await sandboxWithOutput(`## main\n${code} change.txt\n`)
  const status = await sandbox.git.status('/repo')
  expect(status.fileStatus[0]?.status).toBe(expected)
  expect(status.hasConflicts).toBe(false)
  expect(status.conflictCount).toBe(0)
})
