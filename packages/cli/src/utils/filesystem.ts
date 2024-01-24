import * as dockerIgnore from '@balena/dockerignore'
import * as fsWalk from '@nodelib/fs.walk'
import * as fs from 'fs'
import * as gitIgnore from 'ignore'
import * as path from 'path'
import * as util from 'util'

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
 * @param opts.overrideIgnoreFor - If specified, files that should be ignored will be still included if they match this list.
 */
export async function getFiles(
  rootPath: string,
  opts?: {
    extension?: string;
    name?: string;
    respectGitignore?: boolean;
    respectDockerignore?: boolean;
    overrideIgnoreFor?: string[];
  },
) {
  let gitignore: gitIgnore.Ignore | undefined
  if (opts?.respectGitignore) {
    const gitignorePath = path.join(rootPath, '.gitignore')
    if (fs.existsSync(gitignorePath)) {
      gitignore = gitIgnore
        .default()
        .add(fs.readFileSync(gitignorePath).toString())
    }
  }

  let dockerignore: { ignores: (path: string) => boolean } | undefined
  if (opts?.respectDockerignore) {
    const dockerignorePath = path.join(rootPath, '.dockerignore')
    if (fs.existsSync(dockerignorePath)) {
      const dockerIgnoreContent = fs.readFileSync(dockerignorePath, 'utf-8')
      const dockerIgnoreLines = dockerIgnoreContent
        .split('\n')
        .map((line) => line.trim())
      dockerignore = dockerIgnore.default().add(dockerIgnoreLines)
    }
  }

  const entries = await walk(rootPath, {
    entryFilter: (e) => {
      return [
        !!e.stats?.isFile(),
        opts?.extension ? e.name.endsWith(opts.extension) : true,
        opts?.name ? e.name === opts.name : true,
        !(gitignore && gitignore.ignores(path.relative(rootPath, e.path))),
        !(
          dockerignore && dockerignore.ignores(path.relative(rootPath, e.path))
        ),
      ].every(Boolean)
    },
    stats: true,
  })

  const files = await Promise.all(
    entries.map(async (e) => {
      return {
        path: e.path as string,
        rootPath: path.join('/', path.relative(rootPath, e.path)),
        name: e.name as string,
      }
    }),
  )

  if (opts?.overrideIgnoreFor) {
    for (const override of opts.overrideIgnoreFor) {
      const overridePath = path.join(rootPath, override)
      if (files.map(file => file.path).indexOf(overridePath) === -1 && fs.existsSync(overridePath)) {
        files.push({
          path: overridePath,
          rootPath: path.join('/', override),
          name: path.basename(overridePath),
        })
      }
    }
  }

  return files
}

export function getRoot(templatePath?: string) {
  const defaultPath = process.cwd()
  if (!templatePath) return defaultPath
  if (path.isAbsolute(templatePath)) return templatePath
  return path.resolve(defaultPath, templatePath)
}

export function cwdRelative(absolutePath: string) {
  return path.relative(process.cwd(), absolutePath)
}
