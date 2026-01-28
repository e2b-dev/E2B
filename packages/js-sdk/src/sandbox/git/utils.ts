import { InvalidArgumentError } from '../../errors'

/**
 * Parsed git status entry for a file.
 */
export interface GitFileStatus {
  /**
   * Path relative to the repository root.
   */
  name: string
  /**
   * Normalized status string (for example, `"modified"` or `"added"`).
   */
  status: GitStatusLabel
  /**
   * Index status character from porcelain output.
   */
  indexStatus: string
  /**
   * Working tree status character from porcelain output.
   */
  workingTreeStatus: string
  /**
   * Whether the change is staged.
   */
  staged: boolean
  /**
   * Original path when the file was renamed.
   */
  renamedFrom?: string
}

/**
 * Supported normalized git status labels.
 */
export type GitStatusLabel =
  | 'conflict'
  | 'renamed'
  | 'copied'
  | 'deleted'
  | 'added'
  | 'modified'
  | 'typechange'
  | 'untracked'
  | 'unknown'

/**
 * Parsed git repository status.
 */
export interface GitStatus {
  /**
   * Current branch name, if available.
   */
  currentBranch?: string
  /**
   * Upstream branch name, if available.
   */
  upstream?: string
  /**
   * Number of commits the branch is ahead of upstream.
   */
  ahead: number
  /**
   * Number of commits the branch is behind upstream.
   */
  behind: number
  /**
   * Whether HEAD is detached.
   */
  detached: boolean
  /**
   * List of file status entries.
   */
  fileStatus: GitFileStatus[]
  /**
   * Whether the repository has no tracked or untracked file changes.
   */
  isClean: boolean
}

/**
 * Parsed git branch list.
 */
export interface GitBranches {
  /**
   * List of branch names.
   */
  branches: string[]
  /**
   * Current branch name, if available.
   */
  currentBranch?: string
}

/**
 * Escape a string for safe use in a shell command.
 *
 * This uses single-quoted shell escaping and safely handles embedded single quotes.
 */
export function shellEscape(value: string): string {
  return `'${value.replace(/'/g, "'\"'\"'")}'`
}

/**
 * Add HTTP(S) credentials to a Git URL.
 *
 * @param url Git repository URL.
 * @param username Username for HTTP(S) authentication.
 * @param password Password or token for HTTP(S) authentication.
 * @returns URL with embedded credentials.
 */
export function withCredentials(
  url: string,
  username?: string,
  password?: string
): string {
  if (!username && !password) {
    return url
  }

  if (!username || !password) {
    throw new InvalidArgumentError(
      'Both username and password are required when using Git credentials.'
    )
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new InvalidArgumentError(`Invalid Git URL: ${url}`)
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new InvalidArgumentError(
      'Only http(s) Git URLs support username/password credentials.'
    )
  }

  parsed.username = username
  parsed.password = password

  return parsed.toString()
}

/**
 * Strip HTTP(S) credentials from a Git URL.
 *
 * @param url Git repository URL.
 * @returns URL without embedded credentials.
 */
export function stripCredentials(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return url
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return url
  }

  if (!parsed.username && !parsed.password) {
    return url
  }

  parsed.username = ''
  parsed.password = ''
  return parsed.toString()
}

/**
 * Derive the default repository directory name from a Git URL.
 *
 * @param url Git repository URL.
 * @returns Repository directory name, if it can be determined.
 */
export function deriveRepoDirFromUrl(url: string): string | undefined {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return undefined
  }

  const trimmedPath = parsed.pathname.replace(/\/+$/, '')
  const lastSegment = trimmedPath.split('/').pop()
  if (!lastSegment) {
    return undefined
  }

  return lastSegment.endsWith('.git') ? lastSegment.slice(0, -4) : lastSegment
}

/**
 * Build a shell-safe git command string.
 *
 * @param args Git command arguments.
 * @param repoPath Repository path for `git -C`, if provided.
 * @returns Shell-safe git command.
 */
export function buildGitCommand(args: string[], repoPath?: string): string {
  const parts = ['git']
  if (repoPath) {
    parts.push('-C', repoPath)
  }
  parts.push(...args)

  return parts.map((part) => shellEscape(part)).join(' ')
}

function parseAheadBehind(segment?: string): { ahead: number; behind: number } {
  if (!segment) {
    return { ahead: 0, behind: 0 }
  }

  let ahead = 0
  let behind = 0

  if (segment.includes('ahead')) {
    try {
      ahead = Number.parseInt(
        segment.split('ahead')[1].split(',')[0].trim(),
        10
      )
    } catch {
      ahead = 0
    }
  }

  if (segment.includes('behind')) {
    try {
      behind = Number.parseInt(
        segment.split('behind')[1].split(',')[0].trim(),
        10
      )
    } catch {
      behind = 0
    }
  }

  return { ahead, behind }
}

function normalizeBranchName(name: string): string {
  if (name.startsWith('HEAD (detached at ')) {
    return name.replace('HEAD (detached at ', '').replace(/\)$/, '')
  }

  return name
    .replace('HEAD (no branch)', 'HEAD')
    .replace('No commits yet on ', '')
    .replace('Initial commit on ', '')
}

function deriveStatus(
  indexStatus: string,
  workingStatus: string
): GitStatusLabel {
  const statuses = new Set([indexStatus, workingStatus])

  if (statuses.has('U')) return 'conflict'
  if (statuses.has('R')) return 'renamed'
  if (statuses.has('C')) return 'copied'
  if (statuses.has('D')) return 'deleted'
  if (statuses.has('A')) return 'added'
  if (statuses.has('M')) return 'modified'
  if (statuses.has('T')) return 'typechange'
  if (statuses.has('?')) return 'untracked'

  return 'unknown'
}

/**
 * Parse `git status --porcelain=1 -b` output into a structured object.
 *
 * @param output Git status output.
 * @returns Parsed {@link GitStatus}.
 */
export function parseGitStatus(output: string): GitStatus {
  const lines = output
    .split('\n')
    .map((line) => line.replace(/\r$/, ''))
    .filter((line) => line.trim().length > 0)

  let currentBranch: string | undefined
  let upstream: string | undefined
  let ahead = 0
  let behind = 0
  let detached = false
  const fileStatus: GitFileStatus[] = []

  if (lines.length === 0) {
    return {
      currentBranch,
      upstream,
      ahead,
      behind,
      detached,
      fileStatus,
      isClean: true,
    }
  }

  const branchLine = lines[0]
  if (branchLine.startsWith('## ')) {
    const branchInfo = branchLine.slice(3)
    const aheadStart = branchInfo.indexOf(' [')
    const branchPart =
      aheadStart === -1 ? branchInfo : branchInfo.slice(0, aheadStart)
    const aheadPart =
      aheadStart === -1 ? undefined : branchInfo.slice(aheadStart + 2, -1)
    const normalizedBranch = normalizeBranchName(branchPart)
    const rawBranch = branchPart
    const isDetached =
      rawBranch.startsWith('HEAD (detached at ') ||
      rawBranch.includes('detached')

    if (isDetached || normalizedBranch.startsWith('HEAD')) {
      detached = true
    } else if (normalizedBranch.includes('...')) {
      const [branch, upstreamBranch] = normalizedBranch.split('...')
      currentBranch = branch || undefined
      upstream = upstreamBranch || undefined
    } else {
      currentBranch = normalizedBranch || undefined
    }

    const aheadBehind = parseAheadBehind(aheadPart)
    ahead = aheadBehind.ahead
    behind = aheadBehind.behind
  }

  for (const line of lines.slice(1)) {
    if (line.startsWith('?? ')) {
      const name = line.slice(3)
      fileStatus.push({
        name,
        status: 'untracked',
        indexStatus: '?',
        workingTreeStatus: '?',
        staged: false,
      })
      continue
    }

    if (line.length < 3) {
      continue
    }

    const indexStatus = line[0]
    const workingTreeStatus = line[1]
    const path = line.slice(3)

    let renamedFrom: string | undefined
    let name = path

    if (path.includes(' -> ')) {
      const parts = path.split(' -> ')
      renamedFrom = parts[0]
      name = parts.slice(1).join(' -> ')
    }

    fileStatus.push({
      name,
      status: deriveStatus(indexStatus, workingTreeStatus),
      indexStatus,
      workingTreeStatus,
      staged: indexStatus !== ' ' && indexStatus !== '?',
      ...(renamedFrom ? { renamedFrom } : {}),
    })
  }

  return {
    currentBranch,
    upstream,
    ahead,
    behind,
    detached,
    fileStatus,
    isClean: fileStatus.length === 0,
  }
}

/**
 * Parse `git branch --format=%(refname:short)\t%(HEAD)` output.
 *
 * @param output Git branch output.
 * @returns Parsed {@link GitBranches}.
 */
export function parseGitBranches(output: string): GitBranches {
  const branches: string[] = []
  let currentBranch: string | undefined

  const lines = output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  for (const line of lines) {
    const parts = line.split('\t')
    const name = parts[0]
    branches.push(name)
    if (parts.length > 1 && parts[1] === '*') {
      currentBranch = name
    }
  }

  return { branches, currentBranch }
}
