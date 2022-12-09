import * as crypto from 'crypto'

export function getFilesHash(files: { name: string; content: string }[]) {
  const shasum = crypto.createHash('sha1')

  files.forEach(({ name, content }) => {
    shasum.update(name)
    shasum.update(content)
  })

  return shasum.digest('hex')
}
