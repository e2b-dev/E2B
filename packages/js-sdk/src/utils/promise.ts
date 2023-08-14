export function assertFulfilled<T>(
  item: PromiseSettledResult<T>,
): item is PromiseFulfilledResult<T> {
  return item.status === 'fulfilled'
}

export function assertRejected<T>(
  item: PromiseSettledResult<T>,
): item is PromiseRejectedResult {
  return item.status === 'rejected'
}

export function formatSettledErrors<T>(settled: PromiseSettledResult<T>[]) {
  if (settled.every(s => s.status === 'fulfilled')) return

  return settled.reduce((prev, curr, i) => {
    if (curr.status === 'rejected') {
      return prev + '\n' + `[${i}]: ` + `${JSON.stringify(curr)}`
    }
    return prev
  }, 'errors:\n')
}

export function createDeferredPromise<T = void>() {
  let resolve: (value: T) => void
  let reject: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return {
    promise,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    reject: reject!,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    resolve: resolve!,
  }
}
