import * as fsWalk from '@nodelib/fs.walk'
import path from 'path'
import { promisify } from 'util'

const walk = promisify(fsWalk.walk)

export async function getFiles(
  rootPath: string,
  opts?: { extension?: string; name?: string },
) {
  const entries = await walk(rootPath, {
    entryFilter: e => {
      return (
        !!e.stats?.isFile() &&
        (opts?.extension ? e.name.endsWith(opts.extension) : true) &&
        (opts?.name ? e.name === opts.name : true)
      )
    },
    stats: true,
  })

  return await Promise.all(
    entries.map(async e => {
      return {
        path: e.path,
        rootPath: path.join('/', path.relative(rootPath, e.path)),
        name: e.name,
      }
    }),
  )
}
