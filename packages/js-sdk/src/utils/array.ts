export function concatUint8Arrays(arrays: Uint8Array[]) {
  const length = arrays.reduce((acc, cur) => acc + cur.length, 0)
  const result = new Uint8Array(length)
  let offset = 0

  for (const array of arrays) {
    result.set(array, offset)
    offset += array.length
  }

  return result
}