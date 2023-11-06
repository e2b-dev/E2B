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
