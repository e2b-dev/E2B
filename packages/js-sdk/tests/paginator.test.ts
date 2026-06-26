import { assert, expect, test } from 'vitest'

import { Paginator } from '../src/utils'

// Build a fake HTTP Response carrying only the `x-next-token` header.
function fakeResponse(nextToken?: string): Response {
  const headers = new Headers()
  if (nextToken !== undefined) {
    headers.set('x-next-token', nextToken)
  }
  return new Response(null, { headers })
}

// Minimal concrete paginator that returns canned pages and drives the shared
// base state machine via `updatePagination`.
class FakePaginator extends Paginator<string> {
  private call = 0

  constructor(
    private readonly pages: Array<{ items: string[]; nextToken?: string }>
  ) {
    super()
  }

  async nextItems(): Promise<string[]> {
    if (!this.hasNext) {
      throw new Error('No more items to fetch')
    }

    const page = this.pages[this.call++]
    this.updatePagination(fakeResponse(page.nextToken))
    return page.items
  }
}

test('paginator exposes pagination state and advances across pages', async () => {
  const paginator = new FakePaginator([
    { items: ['a', 'b'], nextToken: 'tok-2' },
    { items: ['c'], nextToken: undefined },
  ])

  assert.isTrue(paginator.hasNext)
  assert.isUndefined(paginator.nextToken)

  const first = await paginator.nextItems()
  assert.deepEqual(first, ['a', 'b'])
  assert.isTrue(paginator.hasNext)
  assert.equal(paginator.nextToken, 'tok-2')

  const second = await paginator.nextItems()
  assert.deepEqual(second, ['c'])
  assert.isFalse(paginator.hasNext)
  assert.isUndefined(paginator.nextToken)
})

test('paginator throws once exhausted', async () => {
  const paginator = new FakePaginator([{ items: [], nextToken: undefined }])
  await paginator.nextItems()

  assert.isFalse(paginator.hasNext)
  await expect(paginator.nextItems()).rejects.toThrow('No more items to fetch')
})
