import { expect, test } from 'vitest'

import {
  bodyByteLength,
  createBodyBudget,
  ENVD_MAX_INFLIGHT_BODY_BYTES,
} from '../../src/envd/uploadBudget'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (err: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const tick = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

test("the envd upload budget stays under Node's 10 MB HTTP/2 session memory", () => {
  expect(ENVD_MAX_INFLIGHT_BODY_BYTES).toBe(6 * 1024 * 1024)
})

test('bodyByteLength counts buffered bodies and ignores streamed ones', () => {
  expect(bodyByteLength(undefined)).toBe(0)
  expect(bodyByteLength(null)).toBe(0)
  expect(bodyByteLength('héllo')).toBe(6)
  expect(bodyByteLength(new Uint8Array(5))).toBe(5)
  expect(bodyByteLength(new ArrayBuffer(7))).toBe(7)
  expect(bodyByteLength(new Blob(['abc']))).toBe(3)
  expect(bodyByteLength(new URLSearchParams({ a: 'b' }))).toBe(3)

  const form = new FormData()
  form.append('file', new Blob(['0123456789']), 'a.txt')
  form.append('file', new Blob(['01234']), 'b.txt')
  form.append('note', 'xyz')
  expect(bodyByteLength(form)).toBe(4 + 10 + 4 + 5 + 4 + 3)

  expect(bodyByteLength(new ReadableStream({ start: (c) => c.close() }))).toBe(
    0
  )
})

test('admits bodies in order while they fit together', async () => {
  const budget = createBodyBudget(10)
  const started: string[] = []
  const first = deferred<string>()
  const second = deferred<string>()

  const a = budget.run(6, undefined, () => {
    started.push('a')
    return first.promise
  })
  const b = budget.run(6, undefined, () => {
    started.push('b')
    return second.promise
  })
  // Sizeless requests are never held back by waiting uploads.
  const c = budget.run(0, undefined, async () => {
    started.push('c')
    return 'c'
  })
  await tick()
  expect(started.toSorted()).toEqual(['a', 'c'])

  first.resolve('a')
  await a
  await tick()
  expect(started.toSorted()).toEqual(['a', 'b', 'c'])

  second.resolve('b')
  await expect(Promise.all([b, c])).resolves.toEqual(['b', 'c'])
})

test('a body larger than the budget goes through alone and is released on failure', async () => {
  const budget = createBodyBudget(4)
  const started: string[] = []
  const first = deferred<string>()

  const big = budget.run(100, undefined, () => {
    started.push('big')
    return first.promise
  })
  const small = budget.run(1, undefined, async () => {
    started.push('small')
    return 'small'
  })
  await tick()
  expect(started).toEqual(['big'])

  first.reject(new TypeError('fetch failed'))
  await expect(big).rejects.toThrow('fetch failed')
  await expect(small).resolves.toBe('small')
})

test('a request aborted while waiting rejects and unblocks the queue', async () => {
  const budget = createBodyBudget(10)
  const started: string[] = []
  const holder = deferred<string>()
  const controller = new AbortController()

  const a = budget.run(8, undefined, () => {
    started.push('a')
    return holder.promise
  })
  const aborted = budget.run(8, controller.signal, async () => {
    started.push('aborted')
    return 'aborted'
  })
  const queued = budget.run(2, undefined, async () => {
    started.push('queued')
    return 'queued'
  })
  await tick()
  expect(started).toEqual(['a'])

  controller.abort(new Error('gone'))
  await expect(aborted).rejects.toThrow('gone')
  // The small upload behind the aborted one now fits next to the holder.
  await expect(queued).resolves.toBe('queued')
  expect(started).toEqual(['a', 'queued'])

  holder.resolve('a')
  await expect(a).resolves.toBe('a')
})

test('an already aborted request rejects without taking budget', async () => {
  const budget = createBodyBudget(10)
  const controller = new AbortController()
  controller.abort(new Error('gone'))

  await expect(
    budget.run(1, controller.signal, async () => 'never')
  ).rejects.toThrow('gone')
  await expect(budget.run(10, undefined, async () => 'ok')).resolves.toBe('ok')
})
