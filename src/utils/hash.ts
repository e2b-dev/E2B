// Coverts a signed number to its unsigned hexadecimal representation
// `>>> 0` is a conversion to an unsigned 32-bit integer
// `000000` adds padding and `.slice(-8)` removes the excessive padding
function toHex(value: number) {
  return ('0000000' + (value >>> 0).toString(16)).slice(-8)
}

// Creates hash by multiplying each char value
// `hash * 31` is an optimized version of `((hash << 5) - hash)` and the number 31 is used for its mathematical properties:
// https://stackoverflow.com/questions/299304/why-does-javas-hashcode-in-string-use-31-as-a-multiplier
// `| 0` is a conversion to a signed 32-bit integers
function hash(str: string) {
  const intHash = Array.from(str).reduce((hash, char) => 0 | (31 * hash + char.charCodeAt(0)), 0)
  return toHex(intHash)
}

export default hash
