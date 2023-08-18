import crypto from 'crypto'
import crc32 from 'crc/crc32'

const base62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'

function numberToBase62(num: number, length: number) {
  const base = base62.length

  let result = ''
  while (num > 0) {
    result = base62[num % base] + result
    num = Math.floor(num / base)
  }

  while (result.length < length) {
    result = '0' + result
  }

  return result
}

function generateBase62String(length: number) {
  const base = base62.length

  const randomBytes = crypto.randomBytes(length)
  let result = ''

  for (let i = 0; i < length; i++) {
    const byteValue = randomBytes.readUInt8(i)
    result += base62[byteValue % base]
  }

  return result
}

export function generateApiKey() {
  const randomString = generateBase62String(32)
  const checksum = crc32(randomString).toString(16)
  const checksumEncoded = numberToBase62(parseInt(checksum, 16), 6)
  return 'pk_' + randomString + '_' + checksumEncoded
}
