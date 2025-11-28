import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { dynamicGlob, dynamicTar } from '../utils'
import { BASE_STEP_NAME, FINALIZE_STEP_NAME } from './consts'
import type { Path } from 'glob'

/**
 * Read and parse a .dockerignore file.
 *
 * @param contextPath Directory path containing the .dockerignore file
 * @returns Array of ignore patterns (empty lines and comments are filtered out)
 */
export function readDockerignore(contextPath: string): string[] {
  const dockerignorePath = path.join(contextPath, '.dockerignore')
  if (!fs.existsSync(dockerignorePath)) {
    return []
  }

  const content = fs.readFileSync(dockerignorePath, 'utf-8')
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
}

/**
 * Normalize path separators to forward slashes for glob patterns (glob expects / even on Windows)
 * @param path - The path to normalize
 * @returns The normalized path
 */
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/')
}

/**
 * Get all files for a given path and ignore patterns.
 *
 * @param src Path to the source directory
 * @param contextPath Base directory for resolving relative paths
 * @param ignorePatterns Ignore patterns
 * @returns Array of files
 */
export async function getAllFilesInPath(
  src: string,
  contextPath: string,
  ignorePatterns: string[],
  includeDirectories: boolean = true
) {
  const { glob } = await dynamicGlob()
  const files = new Map<string, Path>()

  const globFiles = await glob(src, {
    ignore: ignorePatterns,
    withFileTypes: true,
    // this is required so that the ignore pattern is relative to the file path
    cwd: contextPath,
  })

  for (const file of globFiles) {
    if (file.isDirectory()) {
      // For directories, add the directory itself and all files inside it
      if (includeDirectories) {
        files.set(file.fullpath(), file)
      }
      const dirPattern = normalizePath(
        // When the matched directory is '.', `file.relative()` can be an empty string.
        // In that case, we want to match all files under the current directory instead of
        // creating an absolute glob like '/**/*' which would traverse the entire filesystem.
        path.join(file.relative() || '.', '**/*')
      )
      const dirFiles = await glob(dirPattern, {
        ignore: ignorePatterns,
        withFileTypes: true,
        cwd: contextPath,
      })
      dirFiles.forEach((f) => files.set(f.fullpath(), f))
    } else {
      // For files, just add the file
      files.set(file.fullpath(), file)
    }
  }

  return Array.from(files.values()).sort()
}

/**
 * Calculate a hash of files being copied to detect changes for cache invalidation.
 * The hash includes file content, metadata (mode, size), and relative paths.
 * Note: uid, gid, and mtime are excluded to ensure stable hashes across environments.
 *
 * @param src Source path pattern for files to copy
 * @param dest Destination path where files will be copied
 * @param contextPath Base directory for resolving relative paths
 * @param ignorePatterns Glob patterns to ignore
 * @param resolveSymlinks Whether to resolve symbolic links when hashing
 * @param stackTrace Optional stack trace for error reporting
 * @returns Hex string hash of all files
 * @throws Error if no files match the source pattern
 */
export async function calculateFilesHash(
  src: string,
  dest: string,
  contextPath: string,
  ignorePatterns: string[],
  resolveSymlinks: boolean,
  stackTrace: string | undefined
): Promise<string> {
  const srcPath = path.join(contextPath, src)
  const hash = crypto.createHash('sha256')
  const content = `COPY ${src} ${dest}`

  hash.update(content)

  const files = await getAllFilesInPath(src, contextPath, ignorePatterns, true)

  if (files.length === 0) {
    const error = new Error(`No files found in ${srcPath}`)
    if (stackTrace) {
      error.stack = stackTrace
    }
    throw error
  }

  // Hash stats - only include stable metadata (mode, size)
  // Exclude uid, gid, and mtime to ensure consistent hashes across environments
  const hashStats = (stats: fs.Stats) => {
    hash.update(stats.mode.toString())
    hash.update(stats.size.toString())
  }

  // Process files recursively
  for (const file of files) {
    // Add a relative path to hash calculation
    const relativePath = file.relativePosix()
    hash.update(relativePath)

    // Add stat information to hash calculation
    if (file.isSymbolicLink()) {
      // If the symlink is broken, it will return undefined, otherwise it will return a stats object of the target
      const stats = fs.statSync(file.fullpath(), { throwIfNoEntry: false })
      const shouldFollow =
        resolveSymlinks && (stats?.isFile() || stats?.isDirectory())

      if (!shouldFollow) {
        const stats = fs.lstatSync(file.fullpath())

        hashStats(stats)

        const content = fs.readlinkSync(file.fullpath())
        hash.update(content)

        continue
      }
    }

    const stats = fs.statSync(file.fullpath())
    hashStats(stats)

    // Add file content to hash calculation
    if (stats.isFile()) {
      const content = fs.readFileSync(file.fullpath())
      hash.update(new Uint8Array(content))
    }
  }

  return hash.digest('hex')
}

/**
 * Get the caller's stack trace frame at a specific depth.
 *
 * @param depth The depth of the stack trace to retrieve
 *   - Levels: caller (e.g., TemplateBase.fromImage) > original caller (e.g., user's template file)
 * @returns The caller frame as a string, or undefined if not available
 */
export function getCallerFrame(depth: number): string | undefined {
  const stackTrace = new Error().stack
  if (!stackTrace) {
    return
  }

  const lines = stackTrace.split('\n').slice(1) // Skip the this function (getCallerFrame)
  if (lines.length < depth + 1) {
    return
  }

  return lines.slice(depth).join('\n')
}

// adopted from https://github.com/sindresorhus/callsites
export function callsites(depth: number): NodeJS.CallSite[] {
  const _originalPrepareStackTrace = Error.prepareStackTrace
  try {
    let result: NodeJS.CallSite[] = []
    Error.prepareStackTrace = (_, callSites) => {
      const callSitesWithoutCurrent = callSites.slice(depth)
      result = callSitesWithoutCurrent
      return callSitesWithoutCurrent
    }

    new Error().stack
    return result
  } finally {
    Error.prepareStackTrace = _originalPrepareStackTrace
  }
}

/**
 * Get the directory of the caller at a specific stack depth.
 *
 * @param depth The depth of the stack trace
 * @returns The caller's directory path, or undefined if not available
 */
export function getCallerDirectory(depth: number): string | undefined {
  // +1 depth to skip this function (getCallerDirectory)
  const callSites = callsites(depth + 1)
  if (callSites.length === 0) {
    return undefined
  }

  const fileName = callSites[0].getFileName()
  if (!fileName) {
    return undefined
  }

  return path.dirname(fileName)
}

/**
 * Convert a numeric file mode to a zero-padded octal string.
 *
 * @param mode File mode as a number (e.g., 493 for 0o755)
 * @returns Zero-padded 4-digit octal string (e.g., "0755")
 *
 * @example
 * ```ts
 * padOctal(0o755) // Returns "0755"
 * padOctal(0o644) // Returns "0644"
 * ```
 */
export function padOctal(mode: number): string {
  return mode.toString(8).padStart(4, '0')
}

/**
 * Create a compressed tar stream of files matching a pattern.
 *
 * @param fileName Glob pattern for files to include
 * @param fileContextPath Base directory for resolving file paths
 * @param ignorePatterns Ignore patterns to exclude from the archive
 * @param resolveSymlinks Whether to follow symbolic links
 * @returns A readable stream of the gzipped tar archive
 */
export async function tarFileStream(
  fileName: string,
  fileContextPath: string,
  ignorePatterns: string[],
  resolveSymlinks: boolean
) {
  const { create } = await dynamicTar()

  const allFiles = await getAllFilesInPath(
    fileName,
    fileContextPath,
    ignorePatterns,
    true
  )

  const filePaths = allFiles.map((file) => file.relativePosix())

  return create(
    {
      gzip: true,
      cwd: fileContextPath,
      follow: resolveSymlinks,
      noDirRecurse: true,
    },
    filePaths
  )
}

/**
 * Create a tar stream and calculate its compressed size for upload.
 *
 * @param fileName Glob pattern for files to include
 * @param fileContextPath Base directory for resolving file paths
 * @param resolveSymlinks Whether to follow symbolic links
 * @returns Object containing the content length and upload stream
 */
export async function tarFileStreamUpload(
  fileName: string,
  fileContextPath: string,
  ignorePatterns: string[],
  resolveSymlinks: boolean
) {
  // First pass: calculate the compressed size
  const sizeCalculationStream = await tarFileStream(
    fileName,
    fileContextPath,
    ignorePatterns,
    resolveSymlinks
  )
  let contentLength = 0
  for await (const chunk of sizeCalculationStream as unknown as AsyncIterable<Buffer>) {
    contentLength += chunk.length
  }

  return {
    contentLength,
    uploadStream: await tarFileStream(
      fileName,
      fileContextPath,
      ignorePatterns,
      resolveSymlinks
    ),
  }
}

/**
 * Get the array index for a build step based on its name.
 *
 * Special steps:
 * - BASE_STEP_NAME: Returns 0 (first step)
 * - FINALIZE_STEP_NAME: Returns the last index
 * - Numeric strings: Converted to number
 *
 * @param step Build step name or number as string
 * @param stackTracesLength Total number of stack traces (used for FINALIZE_STEP_NAME)
 * @returns Index for the build step
 */
export function getBuildStepIndex(
  step: string,
  stackTracesLength: number
): number {
  if (step === BASE_STEP_NAME) {
    return 0
  }

  if (step === FINALIZE_STEP_NAME) {
    return stackTracesLength - 1
  }

  return Number(step)
}

/**
 * Read GCP service account JSON from a file or object.
 *
 * @param contextPath Base directory for resolving relative file paths
 * @param pathOrContent Either a path to a JSON file or a service account object
 * @returns Service account JSON as a string
 */
export function readGCPServiceAccountJSON(
  contextPath: string,
  pathOrContent: string | object
): string {
  if (typeof pathOrContent === 'string') {
    return fs.readFileSync(path.join(contextPath, pathOrContent), 'utf-8')
  }
  return JSON.stringify(pathOrContent)
}
