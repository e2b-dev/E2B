import { InvalidArgumentError } from '../../errors'
import type { CommandStartOpts } from '../commands'
import { CommandExitError, type CommandResult } from '../commands/commandHandle'
import { Commands } from '../commands'
import {
  buildGitCommand,
  GitBranches,
  GitStatus,
  parseGitBranches,
  parseGitStatus,
  shellEscape,
  stripCredentials,
  deriveRepoDirFromUrl,
  withCredentials,
} from './utils'

const DEFAULT_GIT_ENV: Record<string, string> = {
  GIT_TERMINAL_PROMPT: '0',
}

/**
 * Options for git operations in the sandbox.
 */
export interface GitRequestOpts
  extends Partial<
    Pick<
      CommandStartOpts,
      'envs' | 'user' | 'cwd' | 'timeoutMs' | 'requestTimeoutMs'
    >
  > { }

/**
 * Options for cloning a repository.
 */
export interface GitCloneOpts extends GitRequestOpts {
  /**
   * Destination path for the clone.
   */
  path?: string
  /**
   * Branch to check out.
   */
  branch?: string
  /**
   * If set, perform a shallow clone with this depth.
   */
  depth?: number
  /**
   * Username for HTTP(S) authentication.
   */
  username?: string
  /**
   * Password or token for HTTP(S) authentication.
   */
  password?: string
  /**
   * Store credentials in the cloned repository when `true`.
   *
   * @default false
   */
  dangerouslyStoreCredentials?: boolean
}

/**
 * Options for initializing a repository.
 */
export interface GitInitOpts extends GitRequestOpts {
  /**
   * Create a bare repository when `true`.
   */
  bare?: boolean
  /**
   * Initial branch name (for example, `"main"`).
   */
  initialBranch?: string
}

/**
 * Options for adding a git remote.
 */
export interface GitRemoteAddOpts extends GitRequestOpts {
  /**
   * Fetch the remote after adding it when `true`.
   */
  fetch?: boolean
  /**
   * Overwrite the remote URL if the remote already exists when `true`.
   */
  overwrite?: boolean
}

/**
 * Options for creating a commit.
 */
export interface GitCommitOpts extends GitRequestOpts {
  /**
   * Commit author name.
   */
  authorName?: string
  /**
   * Commit author email.
   */
  authorEmail?: string
  /**
   * Allow empty commits when `true`.
   */
  allowEmpty?: boolean
}

/**
 * Options for staging files.
 */
export interface GitAddOpts extends GitRequestOpts {
  /**
   * Files to add; when omitted, adds the current directory.
   */
  files?: string[]
  /**
   * When `true` and `files` is omitted, stage all changes.
   */
  all?: boolean
}

/**
 * Supported reset modes.
 */
export type GitResetMode = 'soft' | 'mixed' | 'hard' | 'merge' | 'keep'

/**
 * Options for resetting a repository.
 */
export interface GitResetOpts extends GitRequestOpts {
  /**
   * Reset mode to use.
   */
  mode?: GitResetMode
  /**
   * Commit, branch, or ref to reset to (defaults to HEAD).
   */
  target?: string
  /**
   * Paths to reset.
   */
  paths?: string[]
}

/**
 * Options for restoring files or unstaging changes.
 */
export interface GitRestoreOpts extends GitRequestOpts {
  /**
   * Paths to restore (use `['.']` for all).
   */
  paths: string[]
  /**
   * Restore the index (unstage).
   */
  staged?: boolean
  /**
   * Restore working tree files.
   */
  worktree?: boolean
  /**
   * Restore from the given source (commit, branch, or ref).
   */
  source?: string
}
/**
 * Options for deleting a branch.
 */
export interface GitDeleteBranchOpts extends GitRequestOpts {
  /**
   * Force deletion with `-D` when `true`.
   */
  force?: boolean
}

/**
 * Options for pushing commits.
 */
export interface GitPushOpts extends GitRequestOpts {
  /**
   * Remote name (for example, `"origin"`).
   */
  remote?: string
  /**
   * Branch name to push.
   */
  branch?: string
  /**
   * Set upstream tracking when `true`.
   */
  setUpstream?: boolean
  /**
   * Username for HTTP(S) authentication.
   */
  username?: string
  /**
   * Password or token for HTTP(S) authentication.
   */
  password?: string
}

/**
 * Options for pulling commits.
 */
export interface GitPullOpts extends GitRequestOpts {
  /**
   * Remote name (for example, `"origin"`).
   */
  remote?: string
  /**
   * Branch name to pull.
   */
  branch?: string
  /**
   * Username for HTTP(S) authentication.
   */
  username?: string
  /**
   * Password or token for HTTP(S) authentication.
   */
  password?: string
}

/**
 * Supported scopes for git config operations.
 */
export type GitConfigScope = 'global' | 'local' | 'system'

/**
 * Options for git config operations.
 */
export interface GitConfigOpts extends GitRequestOpts {
  /**
   * Scope for the git config command.
   *
   * @default "global"
   */
  scope?: GitConfigScope
  /**
   * Repository path required when `scope` is `"local"`.
   */
  path?: string
}

/**
 * Options for dangerously authenticating git globally via the credential helper.
 */
export interface GitDangerouslyAuthenticateOpts extends GitRequestOpts {
  /**
   * Username for HTTP(S) authentication.
   */
  username: string
  /**
   * Password or token for HTTP(S) authentication.
   */
  password: string
  /**
   * Host to authenticate for.
   *
   * @default "github.com"
   */
  host?: string
  /**
   * Protocol to authenticate for.
   *
   * @default "https"
   */
  protocol?: string
}

/**
 * Module for running git operations in the sandbox.
 */
export class Git {
  constructor(private readonly commands: Commands) { }

  /**
   * Clone a git repository into the sandbox.
   *
   * @param url Git repository URL.
   * @param opts Clone options.
   * @returns Command result from the command runner.
   */
  async clone(url: string, opts?: GitCloneOpts): Promise<CommandResult> {
    const {
      username,
      password,
      branch,
      depth,
      path,
      dangerouslyStoreCredentials,
      ...rest
    } = opts ?? {}

    if (password && !username) {
      throw new InvalidArgumentError(
        'Username is required when using a password or token for git clone.'
      )
    }

    const attemptClone = async (
      authUsername?: string,
      authPassword?: string
    ): Promise<CommandResult> => {
      const cloneUrl =
        authUsername && authPassword
          ? withCredentials(url, authUsername, authPassword)
          : url
      const sanitizedUrl = stripCredentials(cloneUrl)
      const shouldStripCredentials =
        !dangerouslyStoreCredentials && sanitizedUrl !== cloneUrl
      const repoPath = shouldStripCredentials
        ? (path ?? deriveRepoDirFromUrl(url))
        : path

      if (shouldStripCredentials && !repoPath) {
        throw new InvalidArgumentError(
          'A destination path is required when using credentials without storing them.'
        )
      }

      const args = ['clone', cloneUrl]
      if (branch) {
        args.push('--branch', branch, '--single-branch')
      }
      if (depth) {
        args.push('--depth', depth.toString())
      }
      if (path) {
        args.push(path)
      }

      const result = await this.runGit(args, undefined, rest)

      if (shouldStripCredentials && repoPath) {
        await this.runGit(
          ['remote', 'set-url', 'origin', sanitizedUrl],
          repoPath,
          rest
        )
      }

      return result
    }

    try {
      return await attemptClone(username, password)
    } catch (err) {
      if (this.isAuthFailure(err)) {
        throw new InvalidArgumentError(
          this.buildAuthErrorMessage('clone', Boolean(username) && !password)
        )
      }
      throw err
    }
  }

  /**
   * Initialize a new git repository.
   *
   * @param path Destination path for the repository.
   * @param opts Init options.
   * @returns Command result from the command runner.
   */
  async init(path: string, opts?: GitInitOpts): Promise<CommandResult> {
    const { bare, initialBranch, ...rest } = opts ?? {}
    const args = ['init']

    if (initialBranch) {
      args.push('--initial-branch', initialBranch)
    }
    if (bare) {
      args.push('--bare')
    }

    args.push(path)
    return this.runGit(args, undefined, rest)
  }

  /**
   * Add (or update) a remote for a repository.
   *
   * @param path Repository path.
   * @param name Remote name (for example, `"origin"`).
   * @param url Remote URL.
   * @param opts Remote add options.
   * @returns Command result from the command runner.
   */
  async remoteAdd(
    path: string,
    name: string,
    url: string,
    opts?: GitRemoteAddOpts
  ): Promise<CommandResult> {
    if (!name || !url) {
      throw new InvalidArgumentError(
        'Both remote name and URL are required to add a git remote.'
      )
    }

    const { fetch, overwrite, ...rest } = opts ?? {}
    const addArgs = ['remote', 'add']

    if (fetch) {
      addArgs.push('-f')
    }

    addArgs.push(name, url)

    if (!overwrite) {
      return this.runGit(addArgs, path, rest)
    }

    const addCmd = buildGitCommand(addArgs, path)
    const setUrlCmd = buildGitCommand(['remote', 'set-url', name, url], path)
    let cmd = `${addCmd} || ${setUrlCmd}`
    if (fetch) {
      const fetchCmd = buildGitCommand(['fetch', name], path)
      cmd = `(${cmd}) && ${fetchCmd}`
    }
    return this.runShell(cmd, rest)
  }

  /**
   * Get the URL for a git remote.
   *
   * Returns `undefined` when the remote does not exist.
   *
   * @param path Repository path.
   * @param name Remote name (for example, `"origin"`).
   * @param opts Command execution options.
   * @returns Remote URL if present.
   */
  async remoteGet(
    path: string,
    name: string,
    opts?: GitRequestOpts
  ): Promise<string | undefined> {
    if (!name) {
      throw new InvalidArgumentError('Remote name is required.')
    }

    const cmd = `${buildGitCommand(['remote', 'get-url', name], path)} || true`
    const result = await this.runShell(cmd, opts)
    const trimmed = result.stdout.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  /**
   * Get repository status information.
   *
   * @param path Repository path.
   * @param opts Command execution options.
   * @returns Parsed git status.
   */
  async status(path: string, opts?: GitRequestOpts): Promise<GitStatus> {
    const result = await this.runGit(['status', '--porcelain=1', '-b'], path, opts)
    return parseGitStatus(result.stdout)
  }

  /**
   * List branches in a repository.
   *
   * @param path Repository path.
   * @param opts Command execution options.
   * @returns Parsed branch list.
   */
  async branches(path: string, opts?: GitRequestOpts): Promise<GitBranches> {
    const result = await this.runGit(
      ['branch', '--format=%(refname:short)\t%(HEAD)'],
      path,
      opts
    )
    return parseGitBranches(result.stdout)
  }

  /**
   * Create and check out a new branch.
   *
   * @param path Repository path.
   * @param branch Branch name to create.
   * @param opts Command execution options.
   * @returns Command result from the command runner.
   */
  async createBranch(
    path: string,
    branch: string,
    opts?: GitRequestOpts
  ): Promise<CommandResult> {
    return this.runGit(['checkout', '-b', branch], path, opts)
  }

  /**
   * Check out an existing branch.
   *
   * @param path Repository path.
   * @param branch Branch name to check out.
   * @param opts Command execution options.
   * @returns Command result from the command runner.
   */
  async checkoutBranch(
    path: string,
    branch: string,
    opts?: GitRequestOpts
  ): Promise<CommandResult> {
    return this.runGit(['checkout', branch], path, opts)
  }

  /**
   * Delete a branch.
   *
   * @param path Repository path.
   * @param branch Branch name to delete.
   * @param opts Delete options.
   * @returns Command result from the command runner.
   */
  async deleteBranch(
    path: string,
    branch: string,
    opts?: GitDeleteBranchOpts
  ): Promise<CommandResult> {
    const { force, ...rest } = opts ?? {}
    const args = ['branch', force ? '-D' : '-d', branch]
    return this.runGit(args, path, rest)
  }

  /**
   * Stage files for commit.
   *
   * @param path Repository path.
   * @param opts Add options.
   * @returns Command result from the command runner.
   */
  async add(path: string, opts?: GitAddOpts): Promise<CommandResult> {
    const { files, all = true, ...rest } = opts ?? {}
    const args = ['add']

    if (!files || files.length === 0) {
      args.push(all ? '-A' : '.')
    } else {
      args.push('--', ...files)
    }

    return this.runGit(args, path, rest)
  }

  /**
   * Create a commit in the repository.
   *
   * @param path Repository path.
   * @param message Commit message.
   * @param opts Commit options.
   * @returns Command result from the command runner.
   */
  async commit(
    path: string,
    message: string,
    opts?: GitCommitOpts
  ): Promise<CommandResult> {
    const { authorName, authorEmail, allowEmpty, ...rest } = opts ?? {}
    const args = ['commit', '-m', message]

    if (allowEmpty) {
      args.push('--allow-empty')
    }

    const authorArgs: string[] = []
    if (authorName) {
      authorArgs.push('-c', `user.name=${authorName}`)
    }
    if (authorEmail) {
      authorArgs.push('-c', `user.email=${authorEmail}`)
    }

    return this.runGit([...authorArgs, ...args], path, rest)
  }

  /**
   * Reset the current HEAD to a specified state.
   *
   * @param path Repository path.
   * @param opts Reset options.
   * @returns Command result from the command runner.
   */
  async reset(path: string, opts?: GitResetOpts): Promise<CommandResult> {
    const { mode, target, paths, ...rest } = opts ?? {}
    const allowedModes: GitResetMode[] = [
      'soft',
      'mixed',
      'hard',
      'merge',
      'keep',
    ]

    if (mode && !allowedModes.includes(mode)) {
      throw new InvalidArgumentError(
        `Reset mode must be one of ${allowedModes.join(', ')}.`
      )
    }

    const args = ['reset']
    if (mode) {
      args.push(`--${mode}`)
    }
    if (target) {
      args.push(target)
    }
    if (paths && paths.length > 0) {
      args.push('--', ...paths)
    }

    return this.runGit(args, path, rest)
  }

  /**
   * Restore working tree files or unstage changes.
   *
   * @param path Repository path.
   * @param opts Restore options.
   * @returns Command result from the command runner.
   */
  async restore(path: string, opts: GitRestoreOpts): Promise<CommandResult> {
    const { paths, staged, worktree, source, ...rest } = opts

    if (!paths || paths.length === 0) {
      throw new InvalidArgumentError('At least one path is required.')
    }

    let resolvedStaged = staged
    let resolvedWorktree = worktree

    if (staged === undefined && worktree === undefined) {
      resolvedWorktree = true
    } else if (staged === true && worktree === undefined) {
      resolvedWorktree = false
    } else if (staged === undefined && worktree !== undefined) {
      resolvedStaged = false
    }

    if (resolvedStaged === false && resolvedWorktree === false) {
      throw new InvalidArgumentError(
        'At least one of staged or worktree must be true.'
      )
    }

    const args = ['restore']
    if (resolvedWorktree) {
      args.push('--worktree')
    }
    if (resolvedStaged) {
      args.push('--staged')
    }
    if (source) {
      args.push('--source', source)
    }
    args.push('--', ...paths)

    return this.runGit(args, path, rest)
  }

  /**
   * Push commits to a remote.
   *
   * @param path Repository path.
   * @param opts Push options.
   * @returns Command result from the command runner.
   */
  async push(path: string, opts?: GitPushOpts): Promise<CommandResult> {
    const { remote, branch, setUpstream, username, password, ...rest } =
      opts ?? {}

    if (password && !username) {
      throw new InvalidArgumentError(
        'Username is required when using a password or token for git push.'
      )
    }

    const buildArgs = (remoteName?: string) => {
      const args = ['push']
      if (setUpstream) {
        args.push('--set-upstream')
      }
      const targetRemote = remoteName ?? remote
      if (targetRemote) {
        args.push(targetRemote)
      }
      if (branch) {
        args.push(branch)
      }
      return args
    }

    if (username && password) {
      const remoteName = await this.resolveRemoteName(path, remote, rest)
      return this.withRemoteCredentials(
        path,
        remoteName,
        username,
        password,
        rest,
        () => this.runGit(buildArgs(remoteName), path, rest)
      )
    }

    try {
      return await this.runGit(buildArgs(), path, rest)
    } catch (err) {
      if (this.isAuthFailure(err)) {
        throw new InvalidArgumentError(
          this.buildAuthErrorMessage('push', Boolean(username) && !password)
        )
      }
      if (this.isMissingUpstream(err)) {
        throw new InvalidArgumentError(this.buildUpstreamErrorMessage('push'))
      }
      throw err
    }
  }

  /**
   * Pull changes from a remote.
   *
   * @param path Repository path.
   * @param opts Pull options.
   * @returns Command result from the command runner.
   */
  async pull(path: string, opts?: GitPullOpts): Promise<CommandResult> {
    const { remote, branch, username, password, ...rest } = opts ?? {}
    if (password && !username) {
      throw new InvalidArgumentError(
        'Username is required when using a password or token for git pull.'
      )
    }

    const buildArgs = (remoteName?: string) => {
      const args = ['pull']
      const targetRemote = remoteName ?? remote
      if (targetRemote) {
        args.push(targetRemote)
      }
      if (branch) {
        args.push(branch)
      }
      return args
    }

    if (username && password) {
      const remoteName = await this.resolveRemoteName(path, remote, rest)
      return this.withRemoteCredentials(
        path,
        remoteName,
        username,
        password,
        rest,
        () => this.runGit(buildArgs(remoteName), path, rest)
      )
    }

    try {
      return await this.runGit(buildArgs(), path, rest)
    } catch (err) {
      if (this.isAuthFailure(err)) {
        throw new InvalidArgumentError(
          this.buildAuthErrorMessage('pull', Boolean(username) && !password)
        )
      }
      if (this.isMissingUpstream(err)) {
        throw new InvalidArgumentError(this.buildUpstreamErrorMessage('pull'))
      }
      throw err
    }
  }

  /**
   * Set a git config value.
   *
   * Use `scope: "local"` together with `path` to configure a specific repository.
   *
   * @param key Git config key (for example, `"pull.rebase"`).
   * @param value Git config value.
   * @param opts Config options.
   * @returns Command result from the command runner.
   */
  async setConfig(
    key: string,
    value: string,
    opts?: GitConfigOpts
  ): Promise<CommandResult> {
    if (!key) {
      throw new InvalidArgumentError('Git config key is required.')
    }

    const scope = opts?.scope ?? 'global'
    const scopeFlag = this.getScopeFlag(scope)
    const repoPath = this.getRepoPathForScope(scope, opts?.path)

    return this.runGit(['config', scopeFlag, key, value], repoPath, opts)
  }

  /**
   * Get a git config value.
   *
   * Returns `undefined` when the key is not set in the requested scope.
   *
   * @param key Git config key (for example, `"pull.rebase"`).
   * @param opts Config options.
   * @returns The config value if present.
   */
  async getConfig(
    key: string,
    opts?: GitConfigOpts
  ): Promise<string | undefined> {
    if (!key) {
      throw new InvalidArgumentError('Git config key is required.')
    }

    const scope = opts?.scope ?? 'global'
    const scopeFlag = this.getScopeFlag(scope)
    const repoPath = this.getRepoPathForScope(scope, opts?.path)
    const cmd = `${buildGitCommand(['config', scopeFlag, '--get', key], repoPath)} || true`
    const result = await this.runShell(cmd, opts)
    const trimmed = result.stdout.trim()
    return trimmed.length > 0 ? trimmed : undefined
  }

  /**
   * Dangerously authenticate git globally via the credential helper.
   *
   * This persists credentials in the credential store.
   * Prefer short-lived credentials when possible.
   *
   * @param opts Authentication options.
   * @returns Command result from the command runner.
   */
  async dangerouslyAuthenticate(
    opts: GitDangerouslyAuthenticateOpts
  ): Promise<CommandResult> {
    const { username, password, host, protocol, ...rest } = opts

    if (!username || !password) {
      throw new InvalidArgumentError(
        'Both username and password are required to authenticate git.'
      )
    }

    const targetHost = (host ?? 'github.com').trim()
    const targetProtocol = (protocol ?? 'https').trim()
    const credentialInput = [
      `protocol=${targetProtocol}`,
      `host=${targetHost}`,
      `username=${username}`,
      `password=${password}`,
      '',
      '',
    ].join('\n')

    await this.runGit(
      ['config', '--global', 'credential.helper', 'store'],
      undefined,
      rest
    )

    const approveCmd = `printf %s ${shellEscape(credentialInput)} | ${buildGitCommand(
      ['credential', 'approve']
    )}`

    return this.runShell(approveCmd, rest)
  }

  /**
   * Configure global git user name and email.
   *
   * @param name Git user name.
   * @param email Git user email.
   * @param opts Command execution options.
   * @returns Command result from the command runner.
   */
  async configureUser(
    name: string,
    email: string,
    opts?: GitRequestOpts
  ): Promise<CommandResult> {
    if (!name || !email) {
      throw new InvalidArgumentError('Both name and email are required.')
    }

    await this.setConfig('user.name', name, { ...opts, scope: 'global' })
    return this.setConfig('user.email', email, { ...opts, scope: 'global' })
  }

  /**
   * Build and execute a git command inside the sandbox.
   *
   * @param args Git arguments to pass to the git binary.
   * @param repoPath Repository path used with `git -C`, if provided.
   * @param opts Command execution options.
   * @returns Command result from the command runner.
   */
  private async runGit(
    args: string[],
    repoPath?: string,
    opts?: GitRequestOpts
  ): Promise<CommandResult> {
    const { envs, ...rest } = opts ?? {}
    const cmd = buildGitCommand(args, repoPath)
    const mergedEnvs = { ...DEFAULT_GIT_ENV, ...(envs ?? {}) }

    return this.commands.run(cmd, {
      ...rest,
      envs: mergedEnvs,
    })
  }

  /**
   * Execute a raw shell command while applying default git environment variables.
   */
  private async runShell(
    cmd: string,
    opts?: GitRequestOpts
  ): Promise<CommandResult> {
    const { envs, ...rest } = opts ?? {}
    const mergedEnvs = { ...DEFAULT_GIT_ENV, ...(envs ?? {}) }

    return this.commands.run(cmd, {
      ...rest,
      envs: mergedEnvs,
    })
  }

  private async getRemoteUrl(
    path: string,
    remote: string,
    opts?: GitRequestOpts
  ): Promise<string> {
    const result = await this.runGit(['remote', 'get-url', remote], path, opts)
    const url = result.stdout.trim()
    if (!url) {
      throw new InvalidArgumentError(
        `Remote "${remote}" URL not found in repository.`
      )
    }
    return url
  }

  private async resolveRemoteName(
    path: string,
    remote: string | undefined,
    opts?: GitRequestOpts
  ): Promise<string> {
    if (remote) {
      return remote
    }

    const result = await this.runGit(['remote'], path, opts)
    const remotes = result.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    if (remotes.length === 1) {
      return remotes[0]
    }

    throw new InvalidArgumentError(
      'Remote is required when using username/password and the repository has multiple remotes.'
    )
  }

  private isAuthFailure(err: unknown): boolean {
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

  private isMissingUpstream(err: unknown): boolean {
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

  private buildAuthErrorMessage(
    action: 'clone' | 'push' | 'pull',
    missingPassword: boolean
  ): string {
    if (missingPassword) {
      return `Git ${action} requires a password/token for private repositories.`
    }
    return `Git ${action} requires credentials for private repositories.`
  }

  private buildUpstreamErrorMessage(action: 'push' | 'pull'): string {
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

  private async withRemoteCredentials<T>(
    path: string,
    remote: string,
    username: string,
    password: string,
    opts: GitRequestOpts | undefined,
    operation: () => Promise<T>
  ): Promise<T> {
    const originalUrl = await this.getRemoteUrl(path, remote, opts)
    const credentialUrl = withCredentials(originalUrl, username, password)

    await this.runGit(['remote', 'set-url', remote, credentialUrl], path, opts)

    let result: T | undefined
    let operationError: unknown
    try {
      result = await operation()
    } catch (err) {
      operationError = err
    }

    let restoreError: unknown
    try {
      await this.runGit(['remote', 'set-url', remote, originalUrl], path, opts)
    } catch (err) {
      restoreError = err
    }

    if (operationError) {
      throw operationError
    }
    if (restoreError) {
      throw restoreError
    }

    return result as T
  }

  private getScopeFlag(
    scope: GitConfigScope
  ): '--global' | '--local' | '--system' {
    switch (scope) {
      case 'global':
        return '--global'
      case 'system':
        return '--system'
      case 'local':
        return '--local'
    }
  }

  private getRepoPathForScope(
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
}

export type { GitBranches, GitFileStatus, GitStatus } from './utils'
