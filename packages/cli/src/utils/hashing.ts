import * as crypto from 'crypto'

const delimiter = '\0'

export function getFilesHash(files: { name: string; content: string }[]) {
  const shasum = crypto.createHash('sha1')

  files.forEach(({ name, content }) => {
    shasum.update(name)
    // Add delimiter to hash to prevent collisions between files where the join of the name and content is the same
    shasum.update(delimiter)
    shasum.update(content)
  })

  return shasum.digest('base64')
}
