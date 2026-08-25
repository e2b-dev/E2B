import { randomBytes } from 'crypto'

export function generateRandomString(length: number = 16): string {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = randomBytes(length)
  let result = ''

  for (let i = 0; i < length; i++) {
    result += characters[bytes[i] % characters.length]
  }

  return result
}
