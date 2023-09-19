import dockerIgnore from '@balena/dockerignore'
import * as fsWalk from '@nodelib/fs.walk'
import * as fs from 'fs'
import * as fsPromise from 'fs/promises'
import gitIgnore, { Ignore } from 'ignore'
import * as path from 'path'
import tar from 'tar-fs'

const walk = util.promisify(fsWalk.walk)

/**
 * Asynchronously retrieves files from a specified root path.
 *
 * @param rootPath - The root directory from which to retrieve files.
 * @param opts - Optional parameters to filter the files by extension and/or name.
 * @param opts.extension - If specified, only files with this extension will be returned.
 * @param opts.name - If specified, only a file with this name will be returned.
 * @param opts.respectGitignore - If true, files that are ignored by .gitignore will be excluded.
 * @param opts.respectDockerignore - If true, files that are ignored by .dockerignore will be excluded.
 */
export async function getFiles(
  rootPath: string,
  opts?: {
    extension?: string
    name?: string
    respectGitignore?: boolean
    respectDockerignore?: boolean
  },
) {
  let gitignore: Ignore | undefined
  if (opts?.respectGitignore) {
    const gitignorePath = path.join(rootPath, '.gitignore')
    if (fs.existsSync(gitignorePath)) {
      gitignore = gitIgnore().add(fs.readFileSync(gitignorePath).toString())
    }
  }

  let dockerignore: { ignores: (path: string) => boolean } | undefined
  if (opts?.respectDockerignore) {
    const dockerignorePath = path.join(rootPath, '.dockerignore')
    if (fs.existsSync(dockerignorePath)) {
      const dockerIgnoreContent = fs.readFileSync(dockerignorePath, 'utf-8')
      const dockerIgnoreLines = dockerIgnoreContent.split('\n').map(line => line.trim())
      dockerignore = dockerIgnore().add(dockerIgnoreLines)
    }
  }

  const entries = await walk(rootPath, {
    entryFilter: e => {
      return [
        !!e.stats?.isFile(),
        opts?.extension ? e.name.endsWith(opts.extension) : true,
        opts?.name ? e.name === opts.name : true,
        !(gitignore && gitignore.ignores(path.relative(rootPath, e.path))),
        !(dockerignore && dockerignore.ignores(path.relative(rootPath, e.path))),
      ].every(Boolean)
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
  if (!envPath) return defaultPath
  if (path.isAbsolute(envPath)) return envPath
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

export const packToTar = (
  rootPath: string,
  filePaths: string[],
  tarPath: string | Buffer | URL,
) =>
  new Promise((resolve, reject) => {
    tar
      .pack(rootPath, { entries: filePaths })
      .pipe(fs.createWriteStream(tarPath))
      .on('error', reject)
      .on('finish', resolve)
  })
