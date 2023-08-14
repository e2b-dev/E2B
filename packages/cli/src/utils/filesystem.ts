import * as fsWalk from '@nodelib/fs.walk'
import * as path from 'path'
import * as util from 'util'
import * as fsPromise from 'fs/promises'
import * as fs from 'fs'

const walk = util.promisify(fsWalk.walk)

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
        path: e.path as string,
        rootPath: path.join('/', path.relative(rootPath, e.path)),
        name: e.name as string,
      }
    }),
  )
}

export function getRoot(envPath?: string) {
  const defaultPath = process.cwd()

  if (!envPath) {
    return defaultPath
  }

  if (path.isAbsolute(envPath)) {
    return envPath
  }

  return path.resolve(defaultPath, envPath)
}

export async function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    return fsPromise.mkdir(dirPath, { recursive: true })
  }
}

export function cwdRelative(absolutePath: string) {
  return path.relative(process.cwd(), absolutePath)
}
