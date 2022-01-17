export function customAlphabet(alphabet: string, size: number) {
  return () => {
    let id = ''
    // A compact alternative for `for (var i = 0; i < step; i++)`.
    let i = size
    while (i--) {
      // `| 0` is more compact and faster than `Math.floor()`.
      id += alphabet[(Math.random() * alphabet.length) | 0]
    }
    return id
  }
}

const idChars = '1234567890abcdefghijklmnopqrstuvwxyz'

export function makeIDGenerator(length: number) {
  return customAlphabet(idChars, length)
}
