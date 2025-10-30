import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { dynamicGlob, dynamicTar } from '../utils'
import { BASE_STEP_NAME, FINALIZE_STEP_NAME } from './consts'

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
 * Hash the stats of a file or directory.
 *
 * @param hash Hash object to update
 * @param stats File or directory stats
 */
function hashStats(hash: crypto.Hash, stats: fs.Stats | undefined): void {
  if (!stats) {
    return
  }

  hash.update(stats.mode.toString())
  hash.update(stats.uid.toString())
  hash.update(stats.gid.toString())
  hash.update(stats.size.toString())
  hash.update(stats.mtimeMs.toString())
}

/**
 * Calculate a hash of files being copied to detect changes for cache invalidation.
 * The hash includes file content, metadata (mode, uid, gid, size, mtime), and relative paths.
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
  const { glob } = await dynamicGlob()
  let srcPath = path.join(contextPath, src)
  const hash = crypto.createHash('sha256')
  const content = `COPY ${src} ${dest}`

  hash.update(content)

  const files = await glob(srcPath, {
    ignore: ignorePatterns,
    withFileTypes: true,
  })

  if (files.length === 0) {
    const error = new Error(`No files found in ${srcPath}`)
    if (stackTrace) {
      error.stack = stackTrace
    }
    throw error
  }

  // Process files recursively
  await processFilesRecursively(
    files,
    contextPath,
    ignorePatterns,
    resolveSymlinks,
    hash
  )

  return hash.digest('hex')
}

/**
 * Recursively process files and directories for hash calculation.
 *
 * @param files Array of file entries to process
 * @param contextPath Base directory for resolving relative paths
 * @param ignorePatterns Glob patterns to ignore
 * @param resolveSymlinks Whether to resolve symbolic links when hashing
 * @param hash Hash object to update
 * @param hashStats Function to hash file stats
 */
async function processFilesRecursively(
  files: any[],
  contextPath: string,
  ignorePatterns: string[],
  resolveSymlinks: boolean,
  hash: crypto.Hash
): Promise<void> {
  const { glob } = await dynamicGlob()

  for (const file of files) {
    const stats = fs.statSync(file.fullpath(), { throwIfNoEntry: false })
    hashStats(hash, stats)

    const relativePath = path.relative(contextPath, file.fullpath())
    hash.update(relativePath)

    if (file.isDirectory()) {
      // Recursively process all files in the directory
      const dirFiles = await glob(path.join(file.fullpath(), '**/*'), {
        ignore: ignorePatterns,
        withFileTypes: true,
      })

      // Recursively process the directory contents
      await processFilesRecursively(
        dirFiles,
        contextPath,
        ignorePatterns,
        resolveSymlinks,
        hash
      )
      continue
    }

    // Add stat information to hash calculation
    if (file.isSymbolicLink()) {
      // If the symlink is broken, it will return undefined, otherwise it will return a stats object of the target
      const shouldFollow =
        resolveSymlinks && (stats?.isFile() || stats?.isDirectory())

      if (!shouldFollow) {
        const stats = fs.lstatSync(file.fullpath())

        hashStats(hash, stats)

        const content = fs.readlinkSync(file.fullpath())
        hash.update(content)

        continue
      }
    }

    if (stats?.isFile()) {
      const content = fs.readFileSync(file.fullpath())
      hash.update(new Uint8Array(content))
    }
  }
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

/**
 * Extract the directory path from a stack trace line.
 *
 * Matches patterns like:
 * - "at <anonymous> (/path/to/file.js:1:1)"
 * - "at /path/to/file.js:1:1"
 *
 * @param line A line from a stack trace
 * @returns The directory of the file, or undefined if not found
 */
export function matchFileDir(line: string): string | undefined {
  const match = line.match(/\/[^:]+/)
  if (match) {
    const filePath = match[0]
    return path.dirname(filePath)
  }
}

/**
 * Get the directory of the caller at a specific stack depth.
 *
 * @param depth The depth of the stack trace
 * @returns The caller's directory path, or undefined if not available
 */
export function getCallerDirectory(depth: number): string | undefined {
  const caller = getCallerFrame(depth + 1) // +1 depth to skip this function (getCallerDirectory)
  if (!caller) {
    return
  }

  const lines = caller.split('\n')
  if (lines.length === 0) {
    return
  }

  const firstLine = lines[0]
  return matchFileDir(firstLine)
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
 * @param resolveSymlinks Whether to follow symbolic links
 * @returns A readable stream of the gzipped tar archive
 */
export async function tarFileStream(
  fileName: string,
  fileContextPath: string,
  resolveSymlinks: boolean
) {
  const { globSync } = await dynamicGlob()
  const { create } = await dynamicTar()
  const files = globSync(fileName, { cwd: fileContextPath })

  return create(
    {
      gzip: true,
      cwd: fileContextPath,
      follow: resolveSymlinks,
    },
    files
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
  resolveSymlinks: boolean
) {
  // First pass: calculate the compressed size
  const sizeCalculationStream = await tarFileStream(
    fileName,
    fileContextPath,
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
