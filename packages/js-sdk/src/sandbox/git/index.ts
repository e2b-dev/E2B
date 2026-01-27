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
  > {}

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
 * Options for wiring a newly created remote to a local repository.
 */
export interface GitHubCreateRepoRemoteOpts {
  /**
   * Repository path inside the sandbox.
   */
  path: string
  /**
   * Remote name to use.
   *
   * @default "origin"
   */
  remoteName?: string
  /**
   * Use the SSH URL instead of the HTTPS clone URL when `true`.
   */
  useSsh?: boolean
  /**
   * Fetch after adding the remote when `true`.
   */
  fetch?: boolean
  /**
   * Overwrite the remote if it already exists when `true`.
   */
  overwrite?: boolean
}

/**
 * Options for creating a GitHub repository.
 */
export interface GitHubCreateRepoOpts extends GitRequestOpts {
  /**
   * GitHub personal access token or app token.
   *
   * If omitted, uses `GITHUB_PAT`, `GITHUB_TOKEN`, or `GH_TOKEN` from the
   * local environment.
   */
  token?: string
  /**
   * Repository name to create.
   */
  name: string
  /**
   * Organization to create the repository in.
   *
   * When omitted, creates the repository for the authenticated user.
   */
  org?: string
  /**
   * Repository description.
   */
  description?: string
  /**
   * Whether the repository is private.
   */
  private?: boolean
  /**
   * Whether to create an initial commit.
   */
  autoInit?: boolean
  /**
   * Homepage URL.
   */
  homepage?: string
  /**
   * Gitignore template name.
   */
  gitignoreTemplate?: string
  /**
   * License template name.
   */
  licenseTemplate?: string
  /**
   * Base URL for the GitHub API.
   *
   * @default "https://api.github.com"
   */
  apiBaseUrl?: string
  /**
   * Optionally add the created repo as a remote in a sandbox repository.
   */
  addRemote?: GitHubCreateRepoRemoteOpts
}

/**
 * Minimal GitHub repository information returned by {@link createGitHubRepo}.
 */
export interface GitHubRepoInfo {
  /**
   * Repository name.
   */
  name: string
  /**
   * Owner and repository name combined.
   */
  fullName: string
  /**
   * Clone URL over HTTPS.
   */
  cloneUrl: string
  /**
   * Clone URL over SSH.
   */
  sshUrl: string
  /**
   * Web URL for the repository.
   */
  htmlUrl: string
  /**
   * Owner login.
   */
  ownerLogin: string
  /**
   * Default branch name, if available.
   */
  defaultBranch?: string
  /**
   * Whether the repository is private.
   */
  private: boolean
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
  constructor(private readonly commands: Commands) {}

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

      const result = await this.run(args, undefined, rest)

      if (shouldStripCredentials && repoPath) {
        await this.run(
          ['remote', 'set-url', 'origin', sanitizedUrl],
          repoPath,
          rest
        )
      }

      return result
    }

    if (password && !username) {
      throw new InvalidArgumentError(
        'Username is required when using a password or token for git clone.'
      )
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
    return this.run(args, undefined, rest)
  }

  /**
   * Create a new GitHub repository (remote).
   *
   * When `addRemote` is provided, the created repository is added as a remote
   * in an existing sandbox repository.
   * It does not initialize a local repository.
   *
   * @param opts GitHub repository creation options.
   * @returns Minimal information about the created repository.
   */
  async createGitHubRepo(opts: GitHubCreateRepoOpts): Promise<GitHubRepoInfo> {
    const {
      token,
      name,
      org,
      description,
      private: isPrivate,
      autoInit,
      homepage,
      gitignoreTemplate,
      licenseTemplate,
      apiBaseUrl,
      addRemote,
      ...requestOpts
    } = opts

    const resolvedToken =
      token ??
      requestOpts.envs?.GITHUB_PAT ??
      requestOpts.envs?.GITHUB_TOKEN ??
      requestOpts.envs?.GH_TOKEN ??
      process.env.GITHUB_PAT ??
      process.env.GITHUB_TOKEN ??
      process.env.GH_TOKEN

    if (!resolvedToken || !name) {
      throw new InvalidArgumentError(
        'GitHub token and repository name are required to create a GitHub repository.'
      )
    }

    const baseUrl = (apiBaseUrl ?? 'https://api.github.com').replace(/\/+$/, '')
    const endpoint = org
      ? `/orgs/${encodeURIComponent(org)}/repos`
      : '/user/repos'

    const payload: Record<string, unknown> = { name }
    if (description !== undefined) payload.description = description
    if (isPrivate !== undefined) payload.private = isPrivate
    if (autoInit !== undefined) payload.auto_init = autoInit
    if (homepage !== undefined) payload.homepage = homepage
    if (gitignoreTemplate !== undefined) {
      payload.gitignore_template = gitignoreTemplate
    }
    if (licenseTemplate !== undefined)
      payload.license_template = licenseTemplate

    const requestEnv: Record<string, string> = {
      ...(requestOpts.envs ?? {}),
      E2B_GITHUB_TOKEN: resolvedToken,
      E2B_GITHUB_REQUEST_URL: `${baseUrl}${endpoint}`,
      E2B_GITHUB_METHOD: 'POST',
      E2B_GITHUB_PAYLOAD_JSON: JSON.stringify(payload),
    }

    if (requestOpts.requestTimeoutMs !== undefined) {
      requestEnv.E2B_GITHUB_HTTP_TIMEOUT = (
        requestOpts.requestTimeoutMs / 1000
      ).toString()
    }

    const script = [
      'if command -v python3 >/dev/null 2>&1; then',
      "python3 - <<'PY'",
      'import json',
      'import os',
      'import urllib.error',
      'import urllib.request',
      '',
      'def _parse_timeout(value):',
      '    if not value:',
      '        return None',
      '    try:',
      '        return float(value)',
      '    except Exception:',
      '        return None',
      '',
      'method = os.environ.get("E2B_GITHUB_METHOD", "GET")',
      'url = os.environ.get("E2B_GITHUB_REQUEST_URL")',
      'token = os.environ.get("E2B_GITHUB_TOKEN")',
      'payload_raw = os.environ.get("E2B_GITHUB_PAYLOAD_JSON", "")',
      'timeout = _parse_timeout(os.environ.get("E2B_GITHUB_HTTP_TIMEOUT"))',
      '',
      'if not url or not token:',
      '    print(json.dumps({"error": "Missing GitHub request URL or token.", "status": 0}))',
      '    raise SystemExit(0)',
      '',
      'data = payload_raw.encode("utf-8") if payload_raw else None',
      'headers = {',
      '    "Accept": "application/vnd.github+json",',
      '    "Authorization": f"Bearer {token}",',
      '    "X-GitHub-Api-Version": "2022-11-28",',
      '}',
      'if data is not None:',
      '    headers["Content-Type"] = "application/json"',
      '',
      'req = urllib.request.Request(url, data=data, headers=headers, method=method)',
      'try:',
      '    with urllib.request.urlopen(req, timeout=timeout) as resp:',
      '        body = resp.read().decode("utf-8")',
      '        print(body or "{}")',
      'except urllib.error.HTTPError as err:',
      '    body = err.read().decode("utf-8") if err.fp else ""',
      '    message = None',
      '    try:',
      '        parsed = json.loads(body) if body else {}',
      '        message = parsed.get("message")',
      '    except Exception:',
      '        message = None',
      '    message = message or body or getattr(err, "reason", "")',
      '    print(json.dumps({"error": message, "status": err.code}))',
      'except Exception as err:',
      '    print(json.dumps({"error": str(err), "status": 0}))',
      'PY',
      'exit 0',
      'fi',
      '',
      'if command -v curl >/dev/null 2>&1; then',
      'method="${E2B_GITHUB_METHOD:-GET}"',
      'url="${E2B_GITHUB_REQUEST_URL:-}"',
      'token="${E2B_GITHUB_TOKEN:-}"',
      'payload="${E2B_GITHUB_PAYLOAD_JSON:-}"',
      'timeout="${E2B_GITHUB_HTTP_TIMEOUT:-}"',
      '',
      'if [ -z "$url" ] || [ -z "$token" ]; then',
      '  printf \'{"error":"Missing GitHub request URL or token.","status":0}\'',
      '  exit 0',
      'fi',
      '',
      'tmp_file="$(mktemp 2>/dev/null || echo "/tmp/e2b_github_resp_$$")"',
      'curl_args=(-sS -X "$method" -H "Accept: application/vnd.github+json" -H "Authorization: Bearer $token" -H "X-GitHub-Api-Version: 2022-11-28")',
      '',
      'if [ -n "$payload" ]; then',
      '  curl_args+=(-H "Content-Type: application/json" --data "$payload")',
      'fi',
      'if [ -n "$timeout" ]; then',
      '  curl_args+=(--max-time "$timeout")',
      'fi',
      '',
      'status="$(curl "${curl_args[@]}" -o "$tmp_file" -w "%{http_code}" "$url")"',
      'curl_exit=$?',
      'body="$(cat "$tmp_file" 2>/dev/null || true)"',
      'rm -f "$tmp_file"',
      '',
      'if [ "$curl_exit" -ne 0 ]; then',
      '  printf \'{"error":"curl failed with exit %s","status":0}\' "$curl_exit"',
      '  exit 0',
      'fi',
      '',
      'if [ "$status" -ge 400 ]; then',
      '  esc="$(printf \'%s\' "$body" | sed -e \'s/\\\\/\\\\\\\\/g\' -e \'s/\\"/\\\\\\"/g\' -e \'s/\\r/\\\\r/g\' -e \':a;N;$!ba;s/\\n/\\\\n/g\')"',
      '  printf \'{"error":"%s","status":%s}\' "$esc" "$status"',
      '  exit 0',
      'fi',
      '',
      'printf \'%s\' "$body"',
      'exit 0',
      'fi',
      '',
      'printf \'{"error":"python3 or curl is required to call the GitHub API.","status":0}\'',
    ].join('\n')

    const result = await this.runShell(script, {
      ...requestOpts,
      envs: requestEnv,
    })

    const responseText = result.stdout.trim()
    let data: any = undefined
    try {
      data = responseText ? JSON.parse(responseText) : undefined
    } catch {
      data = undefined
    }

    if (!data || typeof data !== 'object') {
      throw new InvalidArgumentError('GitHub API response was not valid JSON.')
    }
    if ('error' in data) {
      const status = data.status ?? 'unknown'
      const message =
        (typeof data.error === 'string' && data.error) ||
        'GitHub API request failed.'
      throw new InvalidArgumentError(
        `GitHub API request failed (${status}): ${message}`
      )
    }

    const repo: GitHubRepoInfo = {
      name: data.name,
      fullName: data.full_name,
      cloneUrl: data.clone_url,
      sshUrl: data.ssh_url,
      htmlUrl: data.html_url,
      ownerLogin: data.owner?.login,
      defaultBranch: data.default_branch,
      private: Boolean(data.private),
    }

    if (addRemote) {
      const remoteName = addRemote.remoteName ?? 'origin'
      const remoteUrl = addRemote.useSsh ? repo.sshUrl : repo.cloneUrl
      await this.remoteAdd(addRemote.path, remoteName, remoteUrl, {
        ...requestOpts,
        fetch: addRemote.fetch,
        overwrite: addRemote.overwrite,
      })
    }

    return repo
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
      return this.run(addArgs, path, rest)
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
    const { remote, branch, setUpstream, username, password, ...rest } =
      opts ?? {}
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

    if (password && !username) {
      throw new InvalidArgumentError(
        'Username is required when using a password or token for git push.'
      )
    }

    if (username && password) {
      const remoteName = await this.resolveRemoteName(path, remote, rest)
      return this.withRemoteCredentials(
        path,
        remoteName,
        username,
        password,
        rest,
        () => this.run(buildArgs(remoteName), path, rest)
      )
    }

    try {
      return await this.run(buildArgs(), path, rest)
    } catch (err) {
      if (this.isAuthFailure(err)) {
        throw new InvalidArgumentError(
          this.buildAuthErrorMessage('push', Boolean(username) && !password)
        )
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

    if (password && !username) {
      throw new InvalidArgumentError(
        'Username is required when using a password or token for git pull.'
      )
    }

    if (username && password) {
      const remoteName = await this.resolveRemoteName(path, remote, rest)
      return this.withRemoteCredentials(
        path,
        remoteName,
        username,
        password,
        rest,
        () => this.run(buildArgs(remoteName), path, rest)
      )
    }

    try {
      return await this.run(buildArgs(), path, rest)
    } catch (err) {
      if (this.isAuthFailure(err)) {
        throw new InvalidArgumentError(
          this.buildAuthErrorMessage('pull', Boolean(username) && !password)
        )
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
  async configSet(
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

    return this.run(['config', scopeFlag, key, value], repoPath, opts)
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
  async configGet(
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

    await this.configSet('user.name', name, { ...opts, scope: 'global' })
    return this.configSet('user.email', email, { ...opts, scope: 'global' })
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

  private async getRemoteUrl(
    path: string,
    remote: string,
    opts?: GitRequestOpts
  ): Promise<string> {
    const result = await this.run(['remote', 'get-url', remote], path, opts)
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

    const result = await this.run(['remote'], path, opts)
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

  private buildAuthErrorMessage(
    action: 'clone' | 'push' | 'pull',
    missingPassword: boolean
  ): string {
    if (missingPassword) {
      return `Git ${action} requires a password/token for private repositories.`
    }
    return `Git ${action} requires credentials for private repositories.`
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

    await this.run(['remote', 'set-url', remote, credentialUrl], path, opts)

    let result: T | undefined
    let operationError: unknown
    try {
      result = await operation()
    } catch (err) {
      operationError = err
    }

    let restoreError: unknown
    try {
      await this.run(['remote', 'set-url', remote, originalUrl], path, opts)
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
