import { InvalidArgumentError } from '../../errors'
import { CommandExitError } from '../commands/commandHandle'

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
 * Scope for git config operations.
 */
export type GitConfigScope = 'global' | 'local' | 'system'

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
  /**
   * Whether the repository has any tracked or untracked file changes.
   */
  hasChanges: boolean
  /**
   * Whether there are staged changes.
   */
  hasStaged: boolean
  /**
   * Whether there are untracked files.
   */
  hasUntracked: boolean
  /**
   * Whether there are merge conflicts.
   */
  hasConflicts: boolean
  /**
   * Total number of changed files.
   */
  totalCount: number
  /**
   * Number of files with staged changes.
   */
  stagedCount: number
  /**
   * Number of files with unstaged changes.
   */
  unstagedCount: number
  /**
   * Number of untracked files.
   */
  untrackedCount: number
  /**
   * Number of files with merge conflicts.
   */
  conflictCount: number
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

type GitPushArgsOptions = {
  remote?: string
  branch?: string
  setUpstream: boolean
}

export function buildPushArgs(
  remoteName: string | undefined,
  opts: GitPushArgsOptions
): string[] {
  const { remote, branch, setUpstream } = opts
  const args = ['push']
  const targetRemote = remoteName ?? remote
  if (setUpstream && targetRemote) {
    args.push('--set-upstream')
  }
  if (targetRemote) {
    args.push(targetRemote)
  }
  if (branch) {
    args.push(branch)
  }
  return args
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
      hasChanges: false,
      hasStaged: false,
      hasUntracked: false,
      hasConflicts: false,
      totalCount: 0,
      stagedCount: 0,
      unstagedCount: 0,
      untrackedCount: 0,
      conflictCount: 0,
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

  const totalCount = fileStatus.length
  const stagedCount = fileStatus.filter((item) => item.staged).length
  const untrackedCount = fileStatus.filter(
    (item) => item.status === 'untracked'
  ).length
  const conflictCount = fileStatus.filter(
    (item) => item.status === 'conflict'
  ).length
  const unstagedCount = totalCount - stagedCount

  return {
    currentBranch,
    upstream,
    ahead,
    behind,
    detached,
    fileStatus,
    isClean: totalCount === 0,
    hasChanges: totalCount > 0,
    hasStaged: stagedCount > 0,
    hasUntracked: untrackedCount > 0,
    hasConflicts: conflictCount > 0,
    totalCount,
    stagedCount,
    unstagedCount,
    untrackedCount,
    conflictCount,
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

export function isAuthFailure(err: unknown): boolean {
  if (!(err instanceof CommandExitError)) {
    return false
  }

  const message = `${err.stderr}\n${err.stdout}`.toLowerCase()
  const authSnippets = [
    'authentication failed',
    'terminal prompts disabled',
    'could not read username',
    'invalid username or password',
    'access denied',
    'permission denied',
    'not authorized',
  ]

  return authSnippets.some((snippet) => message.includes(snippet))
}

export function getScopeFlag(scope: GitConfigScope): `--${GitConfigScope}` {
  if (scope !== 'global' && scope !== 'local' && scope !== 'system') {
    throw new InvalidArgumentError(
      'Git config scope must be one of: global, local, system.'
    )
  }
  return `--${scope}`
}

export function isMissingUpstream(err: unknown): boolean {
  if (!(err instanceof CommandExitError)) {
    return false
  }

  const message = `${err.stderr}\n${err.stdout}`.toLowerCase()
  const upstreamSnippets = [
    'has no upstream branch',
    'no upstream branch',
    'no upstream configured',
    'no tracking information for the current branch',
    'no tracking information',
    'set the remote as upstream',
    'set the upstream branch',
    'please specify which branch you want to merge with',
  ]

  return upstreamSnippets.some((snippet) => message.includes(snippet))
}

export function buildAuthErrorMessage(
  action: 'clone' | 'push' | 'pull',
  missingPassword: boolean
): string {
  if (missingPassword) {
    return `Git ${action} requires a password/token for private repositories.`
  }
  return `Git ${action} requires credentials for private repositories.`
}

export function buildUpstreamErrorMessage(action: 'push' | 'pull'): string {
  if (action === 'push') {
    return (
      'Git push failed because no upstream branch is configured. ' +
      'Set upstream once with { setUpstream: true } (and optional remote/branch), ' +
      'or pass remote and branch explicitly.'
    )
  }

  return (
    'Git pull failed because no upstream branch is configured. ' +
    'Pass remote and branch explicitly, or set upstream once (push with { setUpstream: true } ' +
    'or run: git branch --set-upstream-to=origin/<branch> <branch>).'
  )
}

export function getRepoPathForScope(
  scope: GitConfigScope,
  path?: string
): string | undefined {
  if (scope !== 'local') {
    return undefined
  }
  if (!path) {
    throw new InvalidArgumentError(
      'A repository path is required when using scope "local".'
    )
  }
  return path
}
