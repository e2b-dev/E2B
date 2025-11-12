import type { PathLike } from 'node:fs'
import { ApiClient } from '../api'
import { ConnectionConfig } from '../connectionConfig'
import { BuildError } from '../errors'
import { runtime } from '../utils'
import {
  getBuildStatus,
  GetBuildStatusResponse,
  getFileUploadLink,
  requestBuild,
  triggerBuild,
  TriggerBuildTemplate,
  uploadFile,
  waitForBuildFinish,
} from './buildApi'
import { RESOLVE_SYMLINKS, STACK_TRACE_DEPTH } from './consts'
import { parseDockerfile } from './dockerfileParser'
import { LogEntry, LogEntryEnd, LogEntryStart } from './logger'
import { ReadyCmd, waitForFile } from './readycmd'
import {
  BuildInfo,
  BuildOptions,
  CopyItem,
  GetBuildStatusOptions,
  Instruction,
  InstructionType,
  McpServerName,
  RegistryConfig,
  TemplateBuilder,
  TemplateClass,
  TemplateFinal,
  TemplateFromImage,
  TemplateOptions,
} from './types'
import {
  calculateFilesHash,
  getCallerDirectory,
  getCallerFrame,
  padOctal,
  readDockerignore,
  readGCPServiceAccountJSON,
} from './utils'

/**
 * Base class for building E2B sandbox templates.
 */
export class TemplateBase
  implements TemplateFromImage, TemplateBuilder, TemplateFinal
{
  private defaultBaseImage: string = 'e2bdev/base'
  private baseImage: string | undefined = this.defaultBaseImage
  private baseTemplate: string | undefined = undefined
  private registryConfig: RegistryConfig | undefined = undefined
  private startCmd: string | undefined = undefined
  private readyCmd: string | undefined = undefined
  // Force the whole template to be rebuilt
  private force: boolean = false
  // Force the next layer to be rebuilt
  private forceNextLayer: boolean = false
  private instructions: Instruction[] = []
  private fileContextPath: PathLike =
    runtime === 'browser' ? '.' : (getCallerDirectory(STACK_TRACE_DEPTH) ?? '.')
  private fileIgnorePatterns: string[] = []
  private logsRefreshFrequency: number = 200
  private stackTraces: (string | undefined)[] = []
  private stackTracesEnabled: boolean = true
  private stackTracesOverride: string | undefined = undefined

  constructor(options?: TemplateOptions) {
    this.fileContextPath = options?.fileContextPath ?? this.fileContextPath
    this.fileIgnorePatterns =
      options?.fileIgnorePatterns ?? this.fileIgnorePatterns
  }

  /**
   * Convert a template to JSON representation.
   *
   * @param template The template to convert
   * @param computeHashes Whether to compute file hashes for cache invalidation
   * @returns JSON string representation of the template
   */
  static toJSON(
    template: TemplateClass,
    computeHashes: boolean = true
  ): Promise<string> {
    return (template as TemplateBase).toJSON(computeHashes)
  }

  /**
   * Convert a template to Dockerfile format.
   * Note: Templates based on other E2B templates cannot be converted to Dockerfile.
   *
   * @param template The template to convert
   * @returns Dockerfile string representation
   * @throws Error if the template is based on another E2B template
   */
  static toDockerfile(template: TemplateClass): string {
    return (template as TemplateBase).toDockerfile()
  }

  /**
   * Build and deploy a template to E2B infrastructure.
   *
   * @param template The template to build
   * @param options Build configuration options
   *
   * @example
   * ```ts
   * const template = Template().fromPythonImage('3')
   * await Template.build(template, {
   *   alias: 'my-python-env',
   *   cpuCount: 2,
   *   memoryMB: 1024
   * })
   * ```
   */
  static async build(
    template: TemplateClass,
    options: BuildOptions
  ): Promise<BuildInfo> {
    try {
      options.onBuildLogs?.(new LogEntryStart(new Date(), 'Build started'))
      const baseTemplate = template as TemplateBase

      const config = new ConnectionConfig({
        domain: options.domain,
        apiKey: options.apiKey,
      })
      const client = new ApiClient(config)

      const data = await baseTemplate.build(client, options)

      options.onBuildLogs?.(
        new LogEntry(new Date(), 'info', 'Waiting for logs...')
      )

      await waitForBuildFinish(client, {
        templateID: data.templateId,
        buildID: data.buildId,
        onBuildLogs: options.onBuildLogs,
        logsRefreshFrequency: baseTemplate.logsRefreshFrequency,
        stackTraces: baseTemplate.stackTraces,
      })

      return data
    } finally {
      options.onBuildLogs?.(new LogEntryEnd(new Date(), 'Build finished'))
    }
  }

  /**
   * Build and deploy a template to E2B infrastructure.
   *
   * @param template The template to build
   * @param options Build configuration options
   *
   * @example
   * ```ts
   * const template = Template().fromPythonImage('3')
   * const data = await Template.buildInBackground(template, {
   *   alias: 'my-python-env',
   *   cpuCount: 2,
   *   memoryMB: 1024
   * })
   * ```
   */
  static async buildInBackground(
    template: TemplateClass,
    options: BuildOptions
  ): Promise<BuildInfo> {
    const config = new ConnectionConfig({
      domain: options.domain,
      apiKey: options.apiKey,
    })
    const client = new ApiClient(config)

    return await (template as TemplateBase).build(client, options)
  }

  /**
   * Get the status of a build.
   *
   * @param data Build identifiers
   * @param options Authentication options
   *
   * @example
   * ```ts
   * const status = await Template.getBuildStatus(data, { logsOffset: 0 })
   * ```
   */
  static async getBuildStatus(
    data: Pick<BuildInfo, 'templateId' | 'buildId'>,
    options?: GetBuildStatusOptions
  ): Promise<GetBuildStatusResponse> {
    const config = new ConnectionConfig({
      domain: options?.domain,
      apiKey: options?.apiKey,
    })
    const client = new ApiClient(config)

    return await getBuildStatus(client, {
      templateID: data.templateId,
      buildID: data.buildId,
      logsOffset: options?.logsOffset,
    })
  }

  fromDebianImage(variant: string = 'stable'): TemplateBuilder {
    return this.fromImage(`debian:${variant}`)
  }

  fromUbuntuImage(variant: string = 'latest'): TemplateBuilder {
    return this.fromImage(`ubuntu:${variant}`)
  }

  fromPythonImage(version: string = '3'): TemplateBuilder {
    return this.fromImage(`python:${version}`)
  }

  fromNodeImage(variant: string = 'lts'): TemplateBuilder {
    return this.fromImage(`node:${variant}`)
  }

  fromBunImage(variant: string = 'latest'): TemplateBuilder {
    return this.fromImage(`oven/bun:${variant}`)
  }

  fromBaseImage(): TemplateBuilder {
    return this.fromImage(this.defaultBaseImage)
  }

  fromImage(
    baseImage: string,
    credentials?: { username: string; password: string }
  ): TemplateBuilder {
    this.baseImage = baseImage
    this.baseTemplate = undefined

    // Set the registry config if provided
    if (credentials) {
      this.registryConfig = {
        type: 'registry',
        username: credentials.username,
        password: credentials.password,
      }
    }

    // If we should force the next layer and it's a FROM command, invalidate whole template
    if (this.forceNextLayer) {
      this.force = true
    }

    this.collectStackTrace()
    return this
  }

  fromTemplate(template: string): TemplateBuilder {
    this.baseTemplate = template
    this.baseImage = undefined

    // If we should force the next layer and it's a FROM command, invalidate whole template
    if (this.forceNextLayer) {
      this.force = true
    }

    this.collectStackTrace()
    return this
  }

  fromDockerfile(dockerfileContentOrPath: string): TemplateBuilder {
    const { baseImage } = this.runInStackTraceOverrideContext(
      () => parseDockerfile(dockerfileContentOrPath, this),
      // -1 as we're going up the call stack from the parseDockerfile function
      getCallerFrame(STACK_TRACE_DEPTH - 1)
    )
    this.baseImage = baseImage
    this.baseTemplate = undefined

    // If we should force the next layer and it's a FROM command, invalidate whole template
    if (this.forceNextLayer) {
      this.force = true
    }

    this.collectStackTrace()
    return this
  }

  fromAWSRegistry(
    image: string,
    credentials: {
      accessKeyId: string
      secretAccessKey: string
      region: string
    }
  ): TemplateBuilder {
    this.baseImage = image
    this.baseTemplate = undefined

    // Set the registry config if provided
    this.registryConfig = {
      type: 'aws',
      awsAccessKeyId: credentials.accessKeyId,
      awsSecretAccessKey: credentials.secretAccessKey,
      awsRegion: credentials.region,
    }

    // If we should force the next layer and it's a FROM command, invalidate whole template
    if (this.forceNextLayer) {
      this.force = true
    }

    this.collectStackTrace()
    return this
  }

  fromGCPRegistry(
    image: string,
    credentials: {
      serviceAccountJSON: string | object
    }
  ): TemplateBuilder {
    this.baseImage = image
    this.baseTemplate = undefined

    // Set the registry config if provided
    this.registryConfig = {
      type: 'gcp',
      serviceAccountJson: readGCPServiceAccountJSON(
        this.fileContextPath.toString(),
        credentials.serviceAccountJSON
      ),
    }

    // If we should force the next layer and it's a FROM command, invalidate whole template
    if (this.forceNextLayer) {
      this.force = true
    }

    this.collectStackTrace()
    return this
  }

  copy(
    src: PathLike | PathLike[],
    dest: PathLike,
    options?: {
      forceUpload?: true
      user?: string
      mode?: number
      resolveSymlinks?: boolean
    }
  ): TemplateBuilder {
    if (runtime === 'browser') {
      throw new Error('Browser runtime is not supported for copy')
    }

    const srcs = Array.isArray(src) ? src : [src]

    for (const src of srcs) {
      const args = [
        src.toString(),
        dest.toString(),
        options?.user ?? '',
        options?.mode ? padOctal(options.mode) : '',
      ]

      this.instructions.push({
        type: InstructionType.COPY,
        args,
        force: options?.forceUpload || this.forceNextLayer,
        forceUpload: options?.forceUpload,
        resolveSymlinks: options?.resolveSymlinks,
      })
    }

    this.collectStackTrace()
    return this
  }

  copyItems(items: CopyItem[]): TemplateBuilder {
    if (runtime === 'browser') {
      throw new Error('Browser runtime is not supported for copyItems')
    }

    this.runInNewStackTraceContext(() => {
      for (const item of items) {
        this.copy(item.src, item.dest, {
          forceUpload: item.forceUpload,
          user: item.user,
          mode: item.mode,
          resolveSymlinks: item.resolveSymlinks,
        })
      }
    })

    return this
  }

  remove(
    path: PathLike | PathLike[],
    options?: { force?: boolean; recursive?: boolean; user?: string }
  ): TemplateBuilder {
    const paths = Array.isArray(path) ? path : [path]
    const args = ['rm']
    if (options?.recursive) {
      args.push('-r')
    }
    if (options?.force) {
      args.push('-f')
    }
    args.push(...paths.map((p) => p.toString()))
    return this.runInNewStackTraceContext(() =>
      this.runCmd(args.join(' '), { user: options?.user })
    )
  }

  rename(
    src: PathLike,
    dest: PathLike,
    options?: { force?: boolean; user?: string }
  ): TemplateBuilder {
    const args = ['mv', src.toString(), dest.toString()]
    if (options?.force) {
      args.push('-f')
    }
    return this.runInNewStackTraceContext(() =>
      this.runCmd(args.join(' '), { user: options?.user })
    )
  }

  makeDir(
    path: PathLike | PathLike[],
    options?: { mode?: number; user?: string }
  ): TemplateBuilder {
    const paths = Array.isArray(path) ? path : [path]
    const args = ['mkdir', '-p']
    if (options?.mode) {
      args.push(`-m ${padOctal(options.mode)}`)
    }
    args.push(...paths.map((p) => p.toString()))
    return this.runInNewStackTraceContext(() =>
      this.runCmd(args.join(' '), { user: options?.user })
    )
  }

  makeSymlink(
    src: PathLike,
    dest: PathLike,
    options?: { user?: string; force?: boolean }
  ): TemplateBuilder {
    const args = ['ln', '-s']
    if (options?.force) {
      args.push('-f')
    }
    args.push(src.toString(), dest.toString())
    return this.runInNewStackTraceContext(() =>
      this.runCmd(args.join(' '), { user: options?.user })
    )
  }

  runCmd(command: string, options?: { user?: string }): TemplateBuilder
  runCmd(commands: string[], options?: { user?: string }): TemplateBuilder
  runCmd(
    commandOrCommands: string | string[],
    options?: { user?: string }
  ): TemplateBuilder {
    const cmds = Array.isArray(commandOrCommands)
      ? commandOrCommands
      : [commandOrCommands]

    const args = [cmds.join(' && ')]
    if (options?.user) {
      args.push(options.user)
    }

    this.instructions.push({
      type: InstructionType.RUN,
      args,
      force: this.forceNextLayer,
    })

    this.collectStackTrace()
    return this
  }

  setWorkdir(workdir: PathLike): TemplateBuilder {
    this.instructions.push({
      type: InstructionType.WORKDIR,
      args: [workdir.toString()],
      force: this.forceNextLayer,
    })

    this.collectStackTrace()
    return this
  }

  setUser(user: string): TemplateBuilder {
    this.instructions.push({
      type: InstructionType.USER,
      args: [user],
      force: this.forceNextLayer,
    })

    this.collectStackTrace()
    return this
  }

  pipInstall(
    packages?: string | string[],
    options?: { g?: boolean }
  ): TemplateBuilder {
    const g = options?.g ?? true

    const args = ['pip', 'install']
    const packageList = packages
      ? Array.isArray(packages)
        ? packages
        : [packages]
      : undefined
    if (g === false) {
      args.push('--user')
    }
    if (packageList) {
      args.push(...packageList)
    } else {
      args.push('.')
    }

    return this.runInNewStackTraceContext(() =>
      this.runCmd(args.join(' '), {
        user: g ? 'root' : undefined,
      })
    )
  }

  npmInstall(
    packages?: string | string[],
    options?: { g?: boolean; dev?: boolean }
  ): TemplateBuilder {
    const args = ['npm', 'install']
    const packageList = packages
      ? Array.isArray(packages)
        ? packages
        : [packages]
      : undefined
    if (options?.g) {
      args.push('-g')
    }
    if (options?.dev) {
      args.push('--save-dev')
    }
    if (packageList) {
      args.push(...packageList)
    }

    return this.runInNewStackTraceContext(() =>
      this.runCmd(args.join(' '), {
        user: options?.g ? 'root' : undefined,
      })
    )
  }

  bunInstall(
    packages?: string | string[],
    options?: { g?: boolean; dev?: boolean }
  ): TemplateBuilder {
    const args = ['bun', 'install']
    const packageList = packages
      ? Array.isArray(packages)
        ? packages
        : [packages]
      : undefined
    if (options?.g) {
      args.push('-g')
    }
    if (options?.dev) {
      args.push('--dev')
    }
    if (packageList) {
      args.push(...packageList)
    }

    return this.runInNewStackTraceContext(() =>
      this.runCmd(args.join(' '), {
        user: options?.g ? 'root' : undefined,
      })
    )
  }

  aptInstall(
    packages: string | string[],
    options?: { noInstallRecommends?: boolean }
  ): TemplateBuilder {
    const packageList = Array.isArray(packages) ? packages : [packages]
    return this.runInNewStackTraceContext(() =>
      this.runCmd(
        [
          'apt-get update',
          `DEBIAN_FRONTEND=noninteractive DEBCONF_NOWARNINGS=yes apt-get install -y ${options?.noInstallRecommends ? '--no-install-recommends ' : ''}${packageList.join(
            ' '
          )}`,
        ],
        { user: 'root' }
      )
    )
  }

  addMcpServer(servers: McpServerName | McpServerName[]): TemplateBuilder {
    if (this.baseTemplate !== 'mcp-gateway') {
      throw new BuildError(
        'MCP servers can only be added to mcp-gateway template',
        getCallerFrame(STACK_TRACE_DEPTH - 1)
      )
    }

    const serverList = Array.isArray(servers) ? servers : [servers]
    return this.runInNewStackTraceContext(() =>
      this.runCmd(`mcp-gateway pull ${serverList.join(' ')}`, {
        user: 'root',
      })
    )
  }

  gitClone(
    url: string,
    path?: PathLike,
    options?: { branch?: string; depth?: number; user?: string }
  ): TemplateBuilder {
    const args = ['git', 'clone', url]
    if (options?.branch) {
      args.push(`--branch ${options.branch}`)
      args.push('--single-branch')
    }
    if (options?.depth) {
      args.push(`--depth ${options.depth}`)
    }
    if (path) {
      args.push(path.toString())
    }

    return this.runInNewStackTraceContext(() =>
      this.runCmd(args.join(' '), { user: options?.user })
    )
  }

  setStartCmd(
    startCommand: string,
    readyCommand: string | ReadyCmd
  ): TemplateFinal {
    this.startCmd = startCommand

    if (readyCommand instanceof ReadyCmd) {
      this.readyCmd = readyCommand.getCmd()
    } else {
      this.readyCmd = readyCommand
    }

    this.collectStackTrace()
    return this
  }

  setReadyCmd(readyCommand: string | ReadyCmd): TemplateFinal {
    if (readyCommand instanceof ReadyCmd) {
      this.readyCmd = readyCommand.getCmd()
    } else {
      this.readyCmd = readyCommand
    }

    this.collectStackTrace()
    return this
  }

  setEnvs(envs: Record<string, string>): TemplateBuilder {
    if (Object.keys(envs).length === 0) {
      return this
    }

    this.instructions.push({
      type: InstructionType.ENV,
      args: Object.entries(envs).flatMap(([key, value]) => [key, value]),
      force: this.forceNextLayer,
    })
    this.collectStackTrace()
    return this
  }

  skipCache(): this {
    this.forceNextLayer = true
    return this
  }

  betaDevContainerPrebuild(devcontainerDirectory: string): TemplateBuilder {
    if (this.baseTemplate !== 'devcontainer') {
      throw new BuildError(
        'Devcontainers can only used in the devcontainer template',
        getCallerFrame(STACK_TRACE_DEPTH - 1)
      )
    }

    return this.runInNewStackTraceContext(() => {
      return this.runCmd(
        `devcontainer build --workspace-folder ${devcontainerDirectory}`,
        { user: 'root' }
      )
    })
  }

  betaSetDevContainerStart(devcontainerDirectory: string): TemplateFinal {
    if (this.baseTemplate !== 'devcontainer') {
      throw new BuildError(
        'Devcontainers can only used in the devcontainer template',
        getCallerFrame(STACK_TRACE_DEPTH - 1)
      )
    }

    return this.runInNewStackTraceContext(() => {
      return this.setStartCmd(
        `sudo devcontainer up --workspace-folder ${devcontainerDirectory} && sudo /prepare-exec.sh ${devcontainerDirectory} | sudo tee /devcontainer.sh > /dev/null && sudo chmod +x /devcontainer.sh && sudo touch /devcontainer.up`,
        waitForFile('/devcontainer.up')
      )
    })
  }

  /**
   * Collect the current stack trace for debugging purposes.
   *
   * @param stackTracesDepth Depth to traverse in the call stack
   * @returns this for method chaining
   */
  private collectStackTrace(stackTracesDepth: number = STACK_TRACE_DEPTH) {
    if (!this.stackTracesEnabled) {
      return this
    }

    if (this.stackTracesOverride) {
      this.stackTraces.push(this.stackTracesOverride)
      return this
    }

    this.stackTraces.push(getCallerFrame(stackTracesDepth))
    return this
  }

  /**
   * Temporarily disable stack trace collection.
   *
   * @returns this for method chaining
   */
  private disableStackTrace() {
    this.stackTracesEnabled = false
    return this
  }

  /**
   * Re-enable stack trace collection.
   *
   * @returns this for method chaining
   */
  private enableStackTrace() {
    this.stackTracesEnabled = true
    return this
  }

  /**
   * Execute a function in a clean stack trace context.
   *
   * @param fn Function to execute
   * @returns The result of the function
   */
  private runInNewStackTraceContext<T>(fn: () => T): T {
    this.disableStackTrace()
    const result = fn()
    this.enableStackTrace()
    this.collectStackTrace(STACK_TRACE_DEPTH + 1)
    return result
  }

  private runInStackTraceOverrideContext<T>(
    fn: () => T,
    stackTraceOverride: string | undefined
  ): T {
    this.stackTracesOverride = stackTraceOverride
    const result = fn()
    this.stackTracesOverride = undefined
    return result
  }

  /**
   * Convert the template to JSON representation.
   *
   * @param computeHashes Whether to compute file hashes for COPY instructions
   * @returns JSON string representation of the template
   */
  private async toJSON(computeHashes: boolean): Promise<string> {
    let instructions = this.instructions
    if (computeHashes) {
      instructions = await this.instructionsWithHashes()
    }

    return JSON.stringify(this.serialize(instructions), undefined, 2)
  }

  /**
   * Convert the template to Dockerfile format.
   *
   * Note: Only templates based on Docker images can be converted to Dockerfile.
   * Templates based on other E2B templates cannot be converted because they
   * may use features not available in standard Dockerfiles.
   *
   * @returns Dockerfile string representation
   * @throws Error if template is based on another E2B template or has no base image
   */
  private toDockerfile(): string {
    if (this.baseTemplate !== undefined) {
      throw new Error(
        'Cannot convert template built from another template to Dockerfile. ' +
          'Templates based on other templates can only be built using the E2B API.'
      )
    }

    if (this.baseImage === undefined) {
      throw new Error('No base image specified for template')
    }

    let dockerfile = `FROM ${this.baseImage}\n`
    for (const instruction of this.instructions) {
      if (instruction.type === InstructionType.RUN) {
        dockerfile += `RUN ${instruction.args[0]}\n`
        continue
      }
      if (instruction.type === InstructionType.COPY) {
        dockerfile += `COPY ${instruction.args[0]} ${instruction.args[1]}\n`
        continue
      }
      if (instruction.type === InstructionType.ENV) {
        const values: string[] = []
        for (let i = 0; i < instruction.args.length; i += 2) {
          values.push(`${instruction.args[i]}=${instruction.args[i + 1]}`)
        }
        dockerfile += `ENV ${values.join(' ')}\n`
        continue
      }
      dockerfile += `${instruction.type} ${instruction.args.join(' ')}\n`
    }
    if (this.startCmd) {
      dockerfile += `ENTRYPOINT ${this.startCmd}\n`
    }
    return dockerfile
  }

  /**
   * Internal implementation of the template build process.
   *
   * @param client API client for communicating with E2B backend
   * @param options Build configuration options
   * @throws BuildError if the build fails
   */
  private async build(
    client: ApiClient,
    options: BuildOptions
  ): Promise<BuildInfo> {
    if (options.skipCache) {
      this.force = true
    }

    // Create template
    options.onBuildLogs?.(
      new LogEntry(
        new Date(),
        'info',
        `Requesting build for template: ${options.alias}`
      )
    )

    const { templateID, buildID } = await requestBuild(client, {
      alias: options.alias,
      cpuCount: options.cpuCount ?? 2,
      memoryMB: options.memoryMB ?? 1024,
    })

    options.onBuildLogs?.(
      new LogEntry(
        new Date(),
        'info',
        `Template created with ID: ${templateID}, Build ID: ${buildID}`
      )
    )

    const instructionsWithHashes = await this.instructionsWithHashes()

    // Upload files in parallel
    const uploadPromises = instructionsWithHashes.map(
      async (instruction, index) => {
        if (instruction.type !== InstructionType.COPY) {
          return
        }

        const src = instruction.args.length > 0 ? instruction.args[0] : null
        const filesHash = instruction.filesHash ?? null
        if (src === null || filesHash === null) {
          throw new Error('Source path and files hash are required')
        }

        const forceUpload = instruction.forceUpload
        let stackTrace = undefined
        if (index + 1 >= 0 && index + 1 < this.stackTraces.length) {
          stackTrace = this.stackTraces[index + 1]
        }

        const { present, url } = await getFileUploadLink(
          client,
          {
            templateID,
            filesHash,
          },
          stackTrace
        )

        if (
          (forceUpload && url != null) ||
          (present === false && url != null)
        ) {
          await uploadFile(
            {
              fileName: src,
              fileContextPath: this.fileContextPath.toString(),
              url,
              ignorePatterns: [
                ...this.fileIgnorePatterns,
                ...readDockerignore(this.fileContextPath.toString()),
              ],
              resolveSymlinks: instruction.resolveSymlinks ?? RESOLVE_SYMLINKS,
            },
            stackTrace
          )
          options.onBuildLogs?.(
            new LogEntry(new Date(), 'info', `Uploaded '${src}'`)
          )
        } else {
          options.onBuildLogs?.(
            new LogEntry(
              new Date(),
              'info',
              `Skipping upload of '${src}', already cached`
            )
          )
        }
      }
    )

    await Promise.all(uploadPromises)

    options.onBuildLogs?.(
      new LogEntry(new Date(), 'info', 'All file uploads completed')
    )

    // Start build
    options.onBuildLogs?.(
      new LogEntry(new Date(), 'info', 'Starting building...')
    )

    await triggerBuild(client, {
      templateID,
      buildID,
      template: this.serialize(instructionsWithHashes),
    })

    return {
      alias: options.alias,
      templateId: templateID,
      buildId: buildID,
    }
  }

  /**
   * Add file hashes to COPY instructions for cache invalidation.
   *
   * @returns Copy of instructions array with filesHash added to COPY instructions
   */
  private async instructionsWithHashes(): Promise<Instruction[]> {
    return Promise.all(
      this.instructions.map(async (instruction, index) => {
        if (instruction.type !== InstructionType.COPY) {
          return instruction
        }

        const src = instruction.args.length > 0 ? instruction.args[0] : null
        const dest = instruction.args.length > 1 ? instruction.args[1] : null
        if (src === null || dest === null) {
          throw new Error('Source path and destination path are required')
        }

        let stackTrace = undefined
        if (index + 1 >= 0 && index + 1 < this.stackTraces.length) {
          stackTrace = this.stackTraces[index + 1]
        }

        return {
          ...instruction,
          filesHash: await calculateFilesHash(
            src,
            dest,
            this.fileContextPath.toString(),
            [
              ...this.fileIgnorePatterns,
              ...(runtime === 'browser'
                ? []
                : readDockerignore(this.fileContextPath.toString())),
            ],
            instruction.resolveSymlinks ?? RESOLVE_SYMLINKS,
            stackTrace
          ),
        }
      })
    )
  }

  /**
   * Serialize the template to the API request format.
   *
   * @param steps Array of build instructions with file hashes
   * @returns Template data formatted for the API
   */
  private serialize(steps: Instruction[]): TriggerBuildTemplate {
    const templateData: TriggerBuildTemplate = {
      startCmd: this.startCmd,
      readyCmd: this.readyCmd,
      steps,
      force: this.force,
    }

    if (this.baseImage !== undefined) {
      templateData.fromImage = this.baseImage
    }

    if (this.baseTemplate !== undefined) {
      templateData.fromTemplate = this.baseTemplate
    }

    if (this.registryConfig !== undefined) {
      templateData.fromImageRegistry = this.registryConfig
    }

    return templateData
  }
}

/**
 * Create a new E2B template builder instance.
 *
 * @param options Optional configuration for the template builder
 * @returns A new template builder instance
 *
 * @example
 * ```ts
 * import { Template } from 'e2b'
 *
 * const template = Template()
 *   .fromPythonImage('3')
 *   .copy('requirements.txt', '/app/')
 *   .pipInstall()
 *
 * await Template.build(template, { alias: 'my-python-app' })
 * ```
 */
export function Template(options?: TemplateOptions): TemplateFromImage {
  return new TemplateBase(options)
}

Template.build = TemplateBase.build
Template.buildInBackground = TemplateBase.buildInBackground
Template.getBuildStatus = TemplateBase.getBuildStatus
Template.toJSON = TemplateBase.toJSON
Template.toDockerfile = TemplateBase.toDockerfile

export type {
  BuildInfo,
  BuildOptions,
  CopyItem,
  GetBuildStatusOptions,
  McpServerName,
  TemplateBuilder,
  TemplateClass,
} from './types'
