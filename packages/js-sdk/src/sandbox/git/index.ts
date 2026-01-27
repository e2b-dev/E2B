import { InvalidArgumentError } from '../../errors'
import type { CommandStartOpts } from '../commands'
import type { CommandResult } from '../commands/commandHandle'
import { Commands } from '../commands'
import {
  buildGitCommand,
  GitBranches,
  GitStatus,
  parseGitBranches,
  parseGitStatus,
  shellEscape,
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
    const { username, password, branch, depth, path, ...rest } = opts ?? {}
    const cloneUrl = withCredentials(url, username, password)

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

    return this.run(args, undefined, rest)
  }

  /**
   * Get repository status information.
   *
   * @param path Repository path.
   * @param opts Command execution options.
   * @returns Parsed git status.
   */
  async status(path: string, opts?: GitRequestOpts): Promise<GitStatus> {
    const result = await this.run(['status', '--porcelain=1', '-b'], path, opts)
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
    const result = await this.run(
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
    return this.run(['checkout', '-b', branch], path, opts)
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
    return this.run(['checkout', branch], path, opts)
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
    return this.run(args, path, rest)
  }

  /**
   * Stage files for commit.
   *
   * @param path Repository path.
   * @param opts Add options.
   * @returns Command result from the command runner.
   */
  async add(path: string, opts?: GitAddOpts): Promise<CommandResult> {
    const { files, all, ...rest } = opts ?? {}
    const args = ['add']

    if (!files || files.length === 0) {
      args.push(all ? '-A' : '.')
    } else {
      args.push('--', ...files)
    }

    return this.run(args, path, rest)
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

    const hasAuthorName = Boolean(authorName)
    const hasAuthorEmail = Boolean(authorEmail)
    if (hasAuthorName !== hasAuthorEmail) {
      throw new InvalidArgumentError(
        'Both authorName and authorEmail are required to set commit author.'
      )
    }

    const authorArgs =
      authorName && authorEmail
        ? ['-c', `user.name=${authorName}`, '-c', `user.email=${authorEmail}`]
        : []

    return this.run([...authorArgs, ...args], path, rest)
  }

  /**
   * Push commits to a remote.
   *
   * @param path Repository path.
   * @param opts Push options.
   * @returns Command result from the command runner.
   */
  async push(path: string, opts?: GitPushOpts): Promise<CommandResult> {
    const { remote, branch, setUpstream, ...rest } = opts ?? {}
    const args = ['push']

    if (setUpstream) {
      args.push('--set-upstream')
    }
    if (remote) {
      args.push(remote)
    }
    if (branch) {
      args.push(branch)
    }

    return this.run(args, path, rest)
  }

  /**
   * Pull changes from a remote.
   *
   * @param path Repository path.
   * @param opts Pull options.
   * @returns Command result from the command runner.
   */
  async pull(path: string, opts?: GitPullOpts): Promise<CommandResult> {
    const { remote, branch, ...rest } = opts ?? {}
    const args = ['pull']

    if (remote) {
      args.push(remote)
    }
    if (branch) {
      args.push(branch)
    }

    return this.run(args, path, rest)
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

    await this.run(
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

    const cmd = `${buildGitCommand(['config', '--global', 'user.name', name])} && ${buildGitCommand(
      ['config', '--global', 'user.email', email]
    )}`

    return this.runShell(cmd, opts)
  }

  /**
   * Build and execute a git command inside the sandbox.
   *
   * @param args Git arguments to pass to the git binary.
   * @param repoPath Repository path used with `git -C`, if provided.
   * @param opts Command execution options.
   * @returns Command result from the command runner.
   */
  private async run(
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
}

export type { GitBranches, GitFileStatus, GitStatus } from './utils'
