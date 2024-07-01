import fs from 'fs/promises'
import ignore from '@balena/dockerignore'

export async function prepareDockerContext (root: string): Promise<string[]> {
  const dockerignore = await fs.readFile(`${root}/.dockerignore`, 'utf-8').catch(() => '')
  const ig = ignore().add(dockerignore.split('\n'))

  const files = await fs.readdir(root)
  return files.filter(file => !ig.ignores(file))
}
