export function assertFulfilled<T>(
  item: PromiseSettledResult<T>
): item is PromiseFulfilledResult<T> {
  return item.status === 'fulfilled'
}

export function assertRejected<T>(
  item: PromiseSettledResult<T>
): item is PromiseRejectedResult {
  return item.status === 'rejected'
}

export function createDeferredPromise<T = void>() {
  let resolve: (value: T) => void
  let reject: (reason?: any) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })

  return {
    resolve: resolve!,
    reject: reject!,
    promise,
  }
}
