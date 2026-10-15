import { assert, expect, test } from 'vitest'
import {
  filterAgentMessage,
  LineSplitter,
  restrictClientCapabilities,
} from '../src/utils'

test('line splitter joins chunks split mid-line', () => {
  const lines = new LineSplitter(1024)

  assert.deepEqual(lines.push('{"a":'), [])
  assert.deepEqual(lines.push('1}\n{"b"'), ['{"a":1}'])
  assert.deepEqual(lines.push(':2}\n\n'), ['{"b":2}', ''])
  assert.equal(lines.flush(), '')
})

test('line splitter keeps the trailing partial line for flush', () => {
  const lines = new LineSplitter(1024)

  assert.deepEqual(lines.push('{"a":1}\n{"b":2}'), ['{"a":1}'])
  assert.equal(lines.flush(), '{"b":2}')
})

test('line splitter rejects messages over the limit in bytes', () => {
  const lines = new LineSplitter(8)

  assert.deepEqual(lines.push('1234567\n'), ['1234567'])
  // Four 3-byte characters are 12 bytes.
  expect(() => lines.push('€€€€')).toThrow(/exceeds the limit of 8 bytes/)
})

test('initialize turns off client filesystem and terminal', () => {
  const message = {
    jsonrpc: '2.0',
    id: 0,
    method: 'initialize',
    params: {
      protocolVersion: 1,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: true,
        _meta: { custom: true },
      },
    },
  }

  const restricted = restrictClientCapabilities(message)

  assert.deepEqual(restricted.params, {
    protocolVersion: 1,
    clientCapabilities: {
      fs: { readTextFile: false, writeTextFile: false },
      terminal: false,
      _meta: { custom: true },
    },
  })
  assert.isTrue(message.params.clientCapabilities.terminal)
})

test('other client messages pass unchanged', () => {
  const message = { jsonrpc: '2.0', id: 1, method: 'session/new', params: {} }

  assert.strictEqual(restrictClientCapabilities(message), message)
})

test('agent requests for client fs and terminal are rejected', () => {
  const { forward, replies } = filterAgentMessage({
    jsonrpc: '2.0',
    id: 7,
    method: 'fs/write_text_file',
    params: { path: '/tmp/x', content: '' },
  })

  assert.isUndefined(forward)
  assert.equal(replies.length, 1)
  assert.deepInclude(replies[0], { jsonrpc: '2.0', id: 7 })
  assert.equal((replies[0] as { error: { code: number } }).error.code, -32601)
})

test('agent notifications for client terminal are dropped silently', () => {
  const { forward, replies } = filterAgentMessage({
    jsonrpc: '2.0',
    method: 'terminal/release',
  })

  assert.isUndefined(forward)
  assert.deepEqual(replies, [])
})

test('batches keep only forwardable messages', () => {
  const update = { jsonrpc: '2.0', method: 'session/update', params: {} }
  const { forward, replies } = filterAgentMessage([
    update,
    { jsonrpc: '2.0', id: 'x', method: 'terminal/create', params: {} },
  ])

  assert.deepEqual(forward, [update])
  assert.equal(replies.length, 1)
})

test('other agent messages are forwarded', () => {
  const message = {
    jsonrpc: '2.0',
    id: 3,
    method: 'session/request_permission',
  }

  assert.deepEqual(filterAgentMessage(message), {
    forward: message,
    replies: [],
  })
})

test('initialize inside a batch is restricted too', () => {
  const [restricted] = restrictClientCapabilities([
    {
      jsonrpc: '2.0',
      id: 0,
      method: 'initialize',
      params: { clientCapabilities: { terminal: true } },
    },
  ]) as { params: { clientCapabilities: unknown } }[]

  assert.deepEqual(restricted.params.clientCapabilities, {
    fs: { readTextFile: false, writeTextFile: false },
    terminal: false,
  })
})

test('message limit must be a positive integer', () => {
  for (const limit of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(() => new LineSplitter(limit)).toThrow(/positive integer/)
  }
})
