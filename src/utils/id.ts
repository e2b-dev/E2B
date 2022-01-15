import { customAlphabet } from 'nanoid'
const idChars = '1234567890abcdefghijklmnopqrstuvwxyz'

export function makeIDGenerator(length: number) {
  return customAlphabet(idChars, length)
}
