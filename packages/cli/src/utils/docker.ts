import fs from 'fs/promises'
import path from 'path'
import ignore from '@balena/dockerignore'
import { pack } from 'tar-fs'

export async function prepareDockerContext (root: string): Promise<NodeJS.ReadableStream> {
  const dockerignore = await fs.readFile(`${root}/.dockerignore`, 'utf-8').catch(() => '')
  const ig = ignore().add(dockerignore.split('\n'))

  return pack(root, {
    ignore: (name: string) => {
      return ig.ignores(path.relative(root, name))
    }
  })
}
