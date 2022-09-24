export function assertFulfilled<T>(item: PromiseSettledResult<T>): item is PromiseFulfilledResult<T> {
  return item.status === 'fulfilled'
}

export function assertRejected<T>(item: PromiseSettledResult<T>): item is PromiseRejectedResult {
  return item.status === 'rejected'
}

export function formatSettledErrors<T>(settled: PromiseSettledResult<T>[]) {
  return settled
    .filter(assertRejected)
    .reduce((prev, curr) => {
      return prev + '\n' + `${JSON.stringify(curr.reason)}`
    }, 'errors:\n')
}

export function evaluateSettledPromises<T>(settled: PromiseSettledResult<T>[]) {
  if (settled.some(s => s.status === 'rejected')) {
    throw new Error(formatSettledErrors(settled))
  }

  return settled.filter(assertFulfilled).map(s => s.value)
}

export function createDeferredPromise<T = void>() {
  let resolve: ((value: T) => void)
  let reject: ((reason?: unknown) => void)
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    resolve: resolve!,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    reject: reject!,
    promise,
  }
}