import { ApiClient } from '../api'
import { ConnectionConfig } from '../connectionConfig'
import { runtime } from '../utils'
import {
  getFileUploadLink,
  requestBuild,
  triggerBuild,
  TriggerBuildTemplate,
  uploadFile,
  waitForBuildFinish,
} from './buildApi'
import { RESOLVE_SYMLINKS, STACK_TRACE_DEPTH } from './consts'
import { parseDockerfile } from './dockerfileParser'
import { ReadyCmd } from './readycmd'
import {
  CopyItem,
  Instruction,
  InstructionType,
  LogEntry,
  RegistryConfig,
  TemplateBuilder,
  TemplateFinal,
  TemplateFromImage,
} from './types'
import {
  calculateFilesHash,
  getCallerDirectory,
  getCallerFrame,
  padOctal,
  readDockerignore,
  readGCPServiceAccountJSON,
} from './utils'
import type { PathLike } from 'node:fs'

export { type TemplateBuilder } from './types'

type TemplateOptions = {
  fileContextPath?: PathLike
  ignoreFilePatterns?: string[]
}

type BasicBuildOptions = {
  alias: string
  cpuCount?: number
  memoryMB?: number
  skipCache?: boolean
  onBuildLogs?: (logEntry: InstanceType<typeof LogEntry>) => void
}

export type BuildOptions = BasicBuildOptions & {
  apiKey?: string
  domain?: string
}

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
    runtime === 'browser' ? '.' : getCallerDirectory(STACK_TRACE_DEPTH) ?? '.'
  private ignoreFilePatterns: string[] = []
  private logsRefreshFrequency: number = 200
  private stackTraces: (string | undefined)[] = []
  private stackTracesEnabled: boolean = true

  constructor(options?: TemplateOptions) {
    this.fileContextPath = options?.fileContextPath ?? this.fileContextPath
    this.ignoreFilePatterns =
      options?.ignoreFilePatterns ?? this.ignoreFilePatterns
  }

  static toJSON(
    template: TemplateClass,
    computeHashes: boolean = true
  ): Promise<string> {
    return (template as TemplateBase).toJSON(computeHashes)
  }

  static toDockerfile(template: TemplateClass): string {
    return (template as TemplateBase).toDockerfile()
  }

  static build(template: TemplateClass, options: BuildOptions): Promise<void> {
    return (template as TemplateBase).build(options)
  }

  // Built-in image mixins
  fromDebianImage(variant: string = 'slim'): TemplateBuilder {
    return this.fromImage(`debian:${variant}`)
  }

  fromUbuntuImage(variant: string = 'lts'): TemplateBuilder {
    return this.fromImage(`ubuntu:${variant}`)
  }

  fromPythonImage(version: string = '3.13'): TemplateBuilder {
    return this.fromImage(`python:${version}`)
  }

  fromNodeImage(variant: string = 'lts'): TemplateBuilder {
    return this.fromImage(`node:${variant}`)
  }

  fromBaseImage(): TemplateBuilder {
    return this.fromImage(this.defaultBaseImage)
  }

  fromImage(baseImage: string): TemplateBuilder
  fromImage(
    baseImage: string,
    credentials: { username: string; password: string }
  ): TemplateBuilder
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

  /**
   * Parse a Dockerfile and convert it to Template SDK format
   *
   * @param dockerfileContentOrPath Either the Dockerfile content as a string,
   *                                or a path to a Dockerfile file
   * @returns TemplateBuilder instance for method chaining
   */
  fromDockerfile(dockerfileContentOrPath: string): TemplateBuilder {
    const { baseImage } = parseDockerfile(dockerfileContentOrPath, this)
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
    baseImage: string,
    credentials: {
      accessKeyId: string
      secretAccessKey: string
      region: string
    }
  ): TemplateBuilder {
    this.baseImage = baseImage
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
    baseImage: string,
    credentials: {
      serviceAccountJSON: string | object
    }
  ): TemplateBuilder {
    this.baseImage = baseImage
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
      forceUpload?: boolean
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
        force: options?.forceUpload ?? this.forceNextLayer,
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
    options?: { force?: boolean; recursive?: boolean }
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
    return this.runInNewStackTraceContext(() => this.runCmd(args.join(' ')))
  }

  rename(
    src: PathLike,
    dest: PathLike,
    options?: { force?: boolean }
  ): TemplateBuilder {
    const args = ['mv', src.toString(), dest.toString()]
    if (options?.force) {
      args.push('-f')
    }
    return this.runInNewStackTraceContext(() => this.runCmd(args.join(' ')))
  }

  makeDir(
    path: PathLike | PathLike[],
    options?: { mode?: number }
  ): TemplateBuilder {
    const paths = Array.isArray(path) ? path : [path]
    const args = ['mkdir', '-p']
    if (options?.mode) {
      args.push(`-m ${padOctal(options.mode)}`)
    }
    args.push(...paths.map((p) => p.toString()))
    return this.runInNewStackTraceContext(() => this.runCmd(args.join(' ')))
  }

  makeSymlink(src: PathLike, dest: PathLike): TemplateBuilder {
    const args = ['ln', '-s', src.toString(), dest.toString()]
    return this.runInNewStackTraceContext(() => this.runCmd(args.join(' ')))
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

  pipInstall(packages?: string | string[]): TemplateBuilder {
    const args = ['pip', 'install']
    const packageList = packages
      ? Array.isArray(packages)
        ? packages
        : [packages]
      : undefined
    if (packageList) {
      args.push(...packageList)
    } else {
      args.push('.')
    }

    return this.runInNewStackTraceContext(() => this.runCmd(args.join(' ')))
  }

  npmInstall(
    packages?: string | string[],
    options?: { g?: boolean }
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
    if (packageList) {
      args.push(...packageList)
    }

    return this.runInNewStackTraceContext(() => this.runCmd(args.join(' ')))
  }

  aptInstall(packages: string | string[]): TemplateBuilder {
    const packageList = Array.isArray(packages) ? packages : [packages]
    return this.runInNewStackTraceContext(() =>
      this.runCmd(
        [
          'apt-get update',
          `DEBIAN_FRONTEND=noninteractive DEBCONF_NOWARNINGS=yes apt-get install -y --no-install-recommends ${packageList.join(
            ' '
          )}`,
        ],
        { user: 'root' }
      )
    )
  }

  gitClone(
    url: string,
    path?: PathLike,
    options?: { branch?: string; depth?: number }
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

    return this.runInNewStackTraceContext(() => this.runCmd(args.join(' ')))
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

  skipCache(): TemplateBuilder {
    this.forceNextLayer = true
    return this
  }

  private collectStackTrace(stackTracesDepth: number = STACK_TRACE_DEPTH) {
    if (!this.stackTracesEnabled) {
      return this
    }

    this.stackTraces.push(getCallerFrame(stackTracesDepth))
    return this
  }

  private disableStackTrace() {
    this.stackTracesEnabled = false
    return this
  }

  private enableStackTrace() {
    this.stackTracesEnabled = true
    return this
  }

  private runInNewStackTraceContext<T>(fn: () => T): T {
    this.disableStackTrace()
    const result = fn()
    this.enableStackTrace()
    this.collectStackTrace(STACK_TRACE_DEPTH + 1)
    return result
  }

  private async toJSON(computeHashes: boolean): Promise<string> {
    let instructions = this.instructions
    if (computeHashes) {
      instructions = await this.instructionsWithHashes()
    }

    return JSON.stringify(this.serialize(instructions), undefined, 2)
  }

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
      dockerfile += `${instruction.type} ${instruction.args.join(' ')}\n`
    }
    if (this.startCmd) {
      dockerfile += `ENTRYPOINT ${this.startCmd}\n`
    }
    return dockerfile
  }

  private async build(options: BuildOptions): Promise<void> {
    const config = new ConnectionConfig({
      domain: options.domain,
      apiKey: options.apiKey,
    })
    const client = new ApiClient(config)

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

    options.onBuildLogs?.(
      new LogEntry(new Date(), 'info', 'Waiting for logs...')
    )

    await waitForBuildFinish(client, {
      templateID,
      buildID,
      onBuildLogs: options.onBuildLogs,
      logsRefreshFrequency: this.logsRefreshFrequency,
      stackTraces: this.stackTraces,
    })
  }

  // We might no longer need this as we move the logic server-side
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
              ...this.ignoreFilePatterns,
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

// Factory function to create Template instances without 'new'
export function Template(options?: TemplateOptions): TemplateFromImage {
  return new TemplateBase(options)
}

Template.build = TemplateBase.build
Template.toJSON = TemplateBase.toJSON
Template.toDockerfile = TemplateBase.toDockerfile

export type TemplateClass = TemplateBuilder | TemplateFinal
