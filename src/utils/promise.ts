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
      return prev + '\n' + curr.reason
    }, 'errors:\n')
}

export function evaluateSettledPromises<T>(settled: PromiseSettledResult<T>[]) {
  if (settled.some(s => s.status === 'rejected')) {
    throw new Error(formatSettledErrors(settled))
  }

  return settled.filter(assertFulfilled).map(s => s.value)
}