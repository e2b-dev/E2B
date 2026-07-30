import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import url from 'node:url'
import { parse, type StackFrame } from 'error-stack-parser-es'
import { dynamicImport } from '../utils'
import { TemplateError } from '../errors'
import { BASE_STEP_NAME, FINALIZE_STEP_NAME } from './consts'
import type { Path } from 'glob'
import type { BuildOptions } from './types'

/**
 * Validate that a source path for copy operations is a relative path that stays
 * within the context directory. This prevents path traversal attacks and ensures
 * files are copied from within the expected directory.
 *
 * @param src The source path to validate
 * @param stackTrace Optional stack trace for error reporting
 * @throws TemplateError if the path is absolute or escapes the context directory
 *
 * Invalid paths:
 * - Absolute paths: /absolute/path, C:\Windows\path
 * - Parent directory escapes: ../foo, foo/../../bar, ./foo/../../../bar
 *
 * Valid paths:
 * - Simple relative: foo, foo/bar
 * - Current directory prefix: ./foo, ./foo/bar
 * - Internal parent refs that don't escape: foo/../bar (stays within context)
 */
export function validateRelativePath(
  src: string,
  stackTrace: string | undefined
): void {
  // Check for absolute paths using Node's cross-platform implementation
  if (path.isAbsolute(src)) {
    const error = new TemplateError(
      `Invalid source path "${src}": absolute paths are not allowed. Use a relative path within the context directory.`,
      stackTrace
    )
    throw error
  }

  // Normalize the path and check if it escapes the context directory
  const normalized = path.normalize(src)

  // After normalization, a path that escapes would be '..' or start with '../'
  // We check for '..' followed by path separator to avoid false positives on filenames like '..myconfig'
  // Examples:
  // - '../foo' -> '../foo' (escapes)
  // - 'foo/../../bar' -> '../bar' (escapes)
  // - './foo/../../../bar' -> '../../bar' (escapes)
  // - 'foo/../bar' -> 'bar' (doesn't escape)
  // - './foo/bar' -> 'foo/bar' (doesn't escape)
  // - '..myconfig' -> '..myconfig' (valid filename, doesn't escape)
  const escapes = normalized === '..' || normalized.startsWith('..' + path.sep)

  if (escapes) {
    const error = new TemplateError(
      `Invalid source path "${src}": path escapes the context directory. The path must stay within the context directory.`,
      stackTrace
    )
    throw error
  }
}

/**
 * Normalize build arguments from different overload signatures.
 * Handles string name or legacy options object with alias.
 *
 * @param nameOrOptions Name or legacy options with alias
 * @param options Optional build options (when first arg is name)
 * @returns Object with normalized name, tags, and build options
 * @throws TemplateError if no template name is provided
 */
export function normalizeBuildArguments(
  nameOrOptions: string | BuildOptions,
  options?: Omit<BuildOptions, 'alias'>
): {
  name: string
  buildOptions: Omit<BuildOptions, 'alias'>
} {
  let name: string
  let buildOptions: Omit<BuildOptions, 'alias'>

  if (typeof nameOrOptions === 'string') {
    name = nameOrOptions
    buildOptions = options ?? {}
  } else {
    // Legacy: options object with alias
    const { alias, ...restOpts } = nameOrOptions
    name = alias
    buildOptions = restOpts
  }

  if (!name || name.length === 0) {
    throw new TemplateError('Name must be provided')
  }

  return { name, buildOptions }
}

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
  const { glob } = await dynamicImport<typeof import('glob')>('glob')
  const files = new Map<string, Path>()

  const globFiles = await glob(src, {
    ignore: ignorePatterns,
    withFileTypes: true,
    dot: true,
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
        dot: true,
        cwd: contextPath,
      })
      dirFiles.forEach((f) => files.set(f.fullpath(), f))
    } else {
      // For files, just add the file
      files.set(file.fullpath(), file)
    }
  }

  // Sort by full path for a deterministic order — the default sort() would
  // stringify the Path objects to '[object Object]' and keep glob order,
  // making the files hash dependent on filesystem traversal order.
  return Array.from(files.values()).sort((a, b) =>
    a.fullpath() < b.fullpath() ? -1 : a.fullpath() > b.fullpath() ? 1 : 0
  )
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
 * Convert a stack-trace file name to a filesystem path.
 * In ESM modules, stack frames report file:// URLs.
 */
function frameFileToPath(fileName: string): string {
  return fileName.startsWith('file:') ? url.fileURLToPath(fileName) : fileName
}

/**
 * Check whether a stack-trace file name refers to user code, i.e. a file
 * outside the SDK's own directory. Node internals (`node:*`) and native
 * frames are never user code.
 */
function isUserFile(fileName: string, sdkDir: string): boolean {
  if (fileName.startsWith('node:') || fileName === 'native') {
    return false
  }
  try {
    const relative = path.relative(
      sdkDir,
      path.dirname(frameFileToPath(fileName))
    )
    return (
      relative !== '' &&
      (relative.startsWith('..') || path.isAbsolute(relative))
    )
  } catch {
    return false
  }
}

/**
 * Capture the current stack and locate the first frame in user code.
 *
 * Frames are selected by boundary rather than by fixed depth: the SDK's own
 * directory is derived from the top frame (which is always SDK code — this
 * module), and the first frame whose file lies outside it is the user's call
 * site. This keeps the result stable when transpilers inject extra frames
 * (e.g. TS class-field initializers) or runtimes elide delegating frames
 * (e.g. Bun's tail-call elision).
 *
 * @returns Parsed frames and the index of the user's frame, -1 when no user
 *   frame is identifiable (e.g. the SDK is bundled into the caller's file)
 */
function captureUserFrames(): {
  frames: StackFrame[]
  userFrameIndex: number
} {
  const frames = parse(new Error(), { allowEmpty: true })
  const ownFile = frames[0]?.fileName
  if (!ownFile) {
    return { frames, userFrameIndex: -1 }
  }
  const sdkDir = path.dirname(frameFileToPath(ownFile))

  const userFrameIndex = frames.findIndex(
    (frame) =>
      frame.fileName !== undefined && isUserFile(frame.fileName, sdkDir)
  )
  return { frames, userFrameIndex }
}

/**
 * Get the stack trace starting at the caller's frame in user code.
 *
 * @returns The stack trace starting at the user's frame, or undefined when no
 *   user frame is identifiable
 */
export function getCallerFrame(): string | undefined {
  const { frames, userFrameIndex } = captureUserFrames()
  if (userFrameIndex === -1) {
    return
  }

  return frames
    .slice(userFrameIndex)
    .map((frame) => frame.source)
    .filter((source): source is string => source !== undefined)
    .join('\n')
}

/**
 * Get the directory of the caller in user code.
 *
 * @returns The caller's directory path, or undefined if not available
 */
export function getCallerDirectory(): string | undefined {
  const { frames, userFrameIndex } = captureUserFrames()
  const fileName =
    userFrameIndex === -1 ? undefined : frames[userFrameIndex].fileName
  if (!fileName) {
    return undefined
  }

  return path.dirname(frameFileToPath(fileName))
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
 * Create a gzipped tar archive of files matching a pattern, spooled to a
 * temporary file on disk.
 *
 * Spooling instead of buffering keeps memory bounded and gives the archive a
 * known size, so the upload can send an exact `Content-Length`. The caller
 * owns the archive's lifetime and must invoke `cleanup` once done with it.
 * This mirrors the Python SDK's `tar_file_stream`.
 *
 * @param fileName Glob pattern for files to include
 * @param fileContextPath Base directory for resolving file paths
 * @param ignorePatterns Ignore patterns to exclude from the archive
 * @param resolveSymlinks Whether to follow symbolic links
 * @param gzip Whether to gzip the archive
 * @returns The archive path, its size in bytes, and a cleanup callback that
 *   removes the spooled archive. Cleanup is best-effort so it can never mask
 *   the upload result — a leaked temp dir is non-fatal, the OS reclaims it.
 */
export async function spoolTarArchive(
  fileName: string,
  fileContextPath: string,
  ignorePatterns: string[],
  resolveSymlinks: boolean,
  gzip: boolean
): Promise<{ path: string; size: number; cleanup: () => Promise<void> }> {
  const { create } = await dynamicImport<typeof import('tar')>('tar')

  const allFiles = await getAllFilesInPath(
    fileName,
    fileContextPath,
    ignorePatterns,
    true
  )

  const filePaths = allFiles.map((file) => file.relativePosix())

  const tmpDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'e2b-template-')
  )
  const tarPath = path.join(tmpDir, 'context.tar.gz')
  const cleanup = () =>
    fs.promises.rm(tmpDir, { recursive: true, force: true }).catch(() => {})

  try {
    await create(
      {
        gzip,
        cwd: fileContextPath,
        follow: resolveSymlinks,
        noDirRecurse: true,
        file: tarPath,
      },
      filePaths
    )

    const { size } = await fs.promises.stat(tarPath)
    return { path: tarPath, size, cleanup }
  } catch (err) {
    await cleanup()
    throw err
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
