import path from 'path'
import { Logger } from '../session/sessionConnection'

export const resolvePath = (
  inputPath: string,
  cwd: string | undefined,
  logger: Logger,
): string => {
  if (inputPath.startsWith('./')) {
    if (!cwd) {
      logger.warn?.(
        `Path starts with './' and cwd isn't set. The path '${inputPath}' will evaluate to '${inputPath.substring(
          1,
        )}', which may not be what you want.`,
      )
    }
    return path.join(cwd || '', inputPath.substring(1))
  }

  if (inputPath.startsWith('../')) {
    if (!cwd) {
      logger.warn?.(
        `Path starts with '../' and cwd isn't set. The path '${inputPath}' will evaluate to '${inputPath.substring(
          2,
        )}', which may not be what you want.`,
      )
    }
    return path.join(cwd || '', inputPath.substring(2))
  }
  if (inputPath.startsWith('~/')) {
    if (!cwd) {
      logger.warn?.(
        `Path starts with '~/' and cwd isn't set. The path '${inputPath}' will evaluate to '/home/user${inputPath.substring(
          1,
        )}', which may not be what you want.`,
      )
    }
    return path.join(cwd || '/home/user', inputPath.substring(1))
  }

  return inputPath
}
