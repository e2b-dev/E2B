import path from 'path-browserify'

import { Logger } from '../sandbox/sandboxConnection'

export const resolvePath = (
  inputPath: string,
  cwd: string | undefined,
  logger: Logger,
): string => {
  let result: string
  if (inputPath.startsWith('./')) {
    result = path.posix.join(cwd || '/home/user', inputPath)
    if (!cwd) {
      logger.warn?.(
        `Path starts with './' and cwd isn't set. The path '${inputPath}' will evaluate to '${result}', which may not be what you want.`,
      )
    }
    return result
  }

  if (inputPath.startsWith('../')) {
    result = path.posix.join(cwd || '/home/user', inputPath)
    if (!cwd) {
      logger.warn?.(
        `Path starts with '../' and cwd isn't set. The path '${inputPath}' will evaluate to '${result}', which may not be what you want.`,
      )
    }
    return result
  }
  if (inputPath.startsWith('~/')) {
    result = path.posix.join(cwd || '/home/user', inputPath.substring(2))
    if (!cwd) {
      logger.warn?.(
        `Path starts with '~/' and cwd isn't set. The path '${inputPath}' will evaluate to '${result}', which may not be what you want.`,
      )
    }
    return result
  }

  if (!inputPath.startsWith('/') && cwd) {
    return path.posix.join(cwd, inputPath)
  }

  return inputPath
}
