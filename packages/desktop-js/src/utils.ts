import { randomInt } from 'crypto'

export function generateRandomString(length: number = 16): string {
  const characters =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''

  for (let i = 0; i < length; i++) {
    result += characters[randomInt(characters.length)]
  }

  return result
}
