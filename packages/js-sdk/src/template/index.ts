import { ApiClient } from '../api'
import { runtime } from '../utils'
import {
  getBuildStatus,
  GetBuildStatusResponse,
  getFileUploadLink,
  requestBuild,
  triggerBuild,
  TriggerBuildTemplate,
  uploadFile,
} from './buildApi'
import { parseDockerfile, DockerfileParserInterface } from './dockerfileParser'
import { BuildError } from '../errors'
import { Duration, Instructions, Steps } from './types'
import {
  calculateFilesHash,
  getCallerDirectory,
  padOctal,
  readDockerignore,
} from './utils'
import stripAnsi from 'strip-ansi'
import { ConnectionConfig } from '../connectionConfig'

type TemplateOptions = {
  fileContextPath?: string
  ignoreFilePaths?: string[]
}

type CopyItem = {
  src: string
  dest: string
  forceUpload?: boolean
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

export class LogEntry {
  constructor(
    public readonly timestamp: Date,
    public readonly level: 'debug' | 'info' | 'warn' | 'error',
    public readonly message: string
  ) {}

  toString() {
    return `[${this.timestamp.toISOString()}] [${this.level}] ${stripAnsi(
      this.message
    )}`
  }
}

// Interface for the initial state - only fromImage methods available
interface TemplateFromImage {
  fromDebianImage(variant?: string): TemplateBuilder
  fromUbuntuImage(variant?: string): TemplateBuilder
  fromPythonImage(version?: string): TemplateBuilder
  fromNodeImage(variant?: string): TemplateBuilder
  fromBaseImage(): TemplateBuilder
  fromImage(baseImage: string): TemplateBuilder
  fromTemplate(template: string): TemplateBuilder
  fromDockerfile(dockerfileContent: string): TemplateBuilder
  skipCache(): TemplateBuilder
}

// Interface for the main builder state - all methods except start/ready commands
interface TemplateBuilder {
  copy(
    src: string,
    dest: string,
    options?: { forceUpload?: true; user?: string; mode?: number }
  ): TemplateBuilder
  copy(
    items: CopyItem[],
    options?: { forceUpload?: true; user?: string; mode?: number }
  ): TemplateBuilder
  remove(
    path: string,
    options?: { force?: boolean; recursive?: boolean }
  ): TemplateBuilder
  rename(
    src: string,
    dest: string,
    options?: { force?: boolean }
  ): TemplateBuilder
  makeDir(
    paths: string | string[],
    options?: { mode?: number }
  ): TemplateBuilder
  makeSymlink(src: string, dest: string): TemplateBuilder
  runCmd(command: string, options?: { user?: string }): TemplateBuilder
  runCmd(commands: string[], options?: { user?: string }): TemplateBuilder
  setWorkdir(workdir: string): TemplateBuilder
  setUser(user: string): TemplateBuilder
  pipInstall(packages: string | string[]): TemplateBuilder
  npmInstall(packages: string | string[]): TemplateBuilder
  aptInstall(packages: string | string[]): TemplateBuilder
  gitClone(
    url: string,
    path: string,
    options?: { branch?: string; depth?: number }
  ): TemplateBuilder
  setEnvs(envs: Record<string, string>): TemplateBuilder
  skipCache(): TemplateBuilder
  setStartCmd(startCommand: string, readyCommand: string): TemplateFinal
  setReadyCmd(command: string): TemplateFinal
}

// Interface for the final state
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface TemplateFinal {}

export class TemplateClass
  implements
    TemplateFromImage,
    TemplateBuilder,
    TemplateFinal,
    DockerfileParserInterface
{
  private defaultBaseImage: string = 'e2bdev/base'
  private baseImage: string | undefined = this.defaultBaseImage
  private baseTemplate: string | undefined = undefined
  private startCmd: string | undefined = undefined
  private readyCmd: string | undefined = undefined
  // Force the whole template to be rebuilt
  private force: boolean = false
  // Force the next layer to be rebuilt
  private forceNextLayer: boolean = false
  private instructions: Instructions[] = []
  private fileContextPath: string =
    runtime === 'browser' ? '.' : getCallerDirectory() ?? '.'
  private ignoreFilePaths: string[] = []

  constructor(options?: TemplateOptions) {
    this.fileContextPath = options?.fileContextPath ?? this.fileContextPath
    this.ignoreFilePaths = options?.ignoreFilePaths ?? this.ignoreFilePaths
  }

  static toJSON(template: TemplateBuilder | TemplateFinal): string {
    return (template as TemplateClass).toJSON()
  }

  static toDockerfile(template: TemplateBuilder | TemplateFinal): string {
    return (template as TemplateClass).toDockerfile()
  }

  static build(
    template: TemplateBuilder | TemplateFinal,
    options: BuildOptions
  ): Promise<void> {
    return (template as TemplateClass).build(options)
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

  // maybe unnecessary
  fromBaseImage(): TemplateBuilder {
    return this.fromImage(this.defaultBaseImage)
  }

  fromImage(baseImage: string): TemplateBuilder {
    this.baseImage = baseImage
    this.baseTemplate = undefined

    // If we should force the next layer and it's a FROM command, invalidate whole template
    if (this.forceNextLayer) {
      this.force = true
    }

    return this
  }

  fromTemplate(template: string): TemplateBuilder {
    this.baseTemplate = template
    this.baseImage = undefined

    // If we should force the next layer and it's a FROM command, invalidate whole template
    if (this.forceNextLayer) {
      this.force = true
    }

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

    return this
  }

  copy(
    src: string,
    dest: string,
    options?: { forceUpload?: true; user?: string; mode?: number }
  ): TemplateBuilder
  copy(
    items: CopyItem[],
    options?: { forceUpload?: true; user?: string; mode?: number }
  ): TemplateBuilder
  copy(
    srcOrItems: string | CopyItem[],
    destOrOptions?:
      | string
      | { forceUpload?: true; user?: string; mode?: number },
    options?: { forceUpload?: true; user?: string; mode?: number }
  ): TemplateBuilder {
    if (runtime === 'browser') {
      throw new Error('Browser runtime is not supported for copy')
    }

    const items = Array.isArray(srcOrItems)
      ? srcOrItems
      : [{ src: srcOrItems, dest: destOrOptions as string }]
    for (const item of items) {
      const args = [
        item.src,
        item.dest,
        options?.user ?? '',
        options?.mode ? padOctal(options.mode) : '',
      ]

      this.instructions.push({
        type: 'COPY',
        args,
        force: options?.forceUpload ?? this.forceNextLayer,
        forceUpload: options?.forceUpload,
      })
    }

    return this
  }

  remove(
    path: string,
    options?: { force?: boolean; recursive?: boolean }
  ): TemplateBuilder {
    const args = ['rm', path]
    if (options?.recursive) {
      args.push('-r')
    }
    if (options?.force) {
      args.push('-f')
    }
    this.runCmd(args.join(' '))
    return this
  }

  rename(
    src: string,
    dest: string,
    options?: { force?: boolean }
  ): TemplateBuilder {
    const args = ['mv', src, dest]
    if (options?.force) {
      args.push('-f')
    }
    this.runCmd(args.join(' '))
    return this
  }

  makeDir(
    paths: string | string[],
    options?: { mode?: number }
  ): TemplateBuilder {
    const args = ['mkdir', '-p', ...(Array.isArray(paths) ? paths : [paths])]
    if (options?.mode) {
      args.push(`-m ${padOctal(options.mode)}`)
    }
    this.runCmd(args.join(' '))
    return this
  }

  makeSymlink(src: string, dest: string): TemplateBuilder {
    const args = ['ln', '-s', src, dest]
    this.runCmd(args.join(' '))
    return this
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
      type: 'RUN',
      args,
      force: this.forceNextLayer,
    })
    return this
  }

  setWorkdir(workdir: string): TemplateBuilder {
    this.instructions.push({
      type: 'WORKDIR',
      args: [workdir],
      force: this.forceNextLayer,
    })
    return this
  }

  setUser(user: string): TemplateBuilder {
    this.instructions.push({
      type: 'USER',
      args: [user],
      force: this.forceNextLayer,
    })
    return this
  }

  pipInstall(packages?: string | string[]): TemplateBuilder {
    const args = ['pip', 'install']
    if (packages) {
      args.push(...packages)
    } else {
      args.push('.')
    }
    return this.runCmd(args)
  }

  npmInstall(packages?: string | string[], g?: boolean): TemplateBuilder {
    const args = ['npm', 'install']
    if (packages) {
      args.push(...packages)
    }
    if (g) {
      args.push('-g')
    }
    return this.runCmd(args)
  }

  aptInstall(packages: string | string[]): TemplateBuilder {
    const packageList = Array.isArray(packages) ? packages : [packages]

    return this.runCmd(
      [
        'apt-get update',
        `DEBIAN_FRONTEND=noninteractive DEBCONF_NOWARNINGS=yes apt-get install -y --no-install-recommends ${packageList.join(
          ' '
        )}`,
      ],
      { user: 'root' }
    )
  }

  gitClone(
    url: string,
    path: string,
    options?: { branch?: string; depth?: number }
  ): TemplateBuilder {
    const args = ['git', 'clone', url, path]
    if (options?.branch) {
      args.push(`--branch ${options.branch}`)
      args.push('--single-branch')
    }
    if (options?.depth) {
      args.push(`--depth ${options.depth}`)
    }
    this.runCmd(args.join(' '))
    return this
  }

  setStartCmd(startCommand: string, readyCommand: string): TemplateFinal {
    this.startCmd = startCommand
    this.readyCmd = readyCommand
    return this
  }

  setReadyCmd(command: string): TemplateFinal {
    this.readyCmd = command
    return this
  }

  setEnvs(envs: Record<string, string>): TemplateBuilder {
    if (Object.keys(envs).length === 0) {
      return this
    }

    this.instructions.push({
      type: 'ENV',
      args: Object.entries(envs).flatMap(([key, value]) => [key, value]),
      force: this.forceNextLayer,
    })
    return this
  }

  skipCache(): TemplateBuilder {
    this.forceNextLayer = true
    return this
  }

  private toJSON(): string {
    return JSON.stringify(
      this.serialize(this.calculateFilesHashes()),
      undefined,
      2
    )
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
      cpuCount: options.cpuCount ?? 1,
      memoryMB: options.memoryMB ?? 1024,
    })

    options.onBuildLogs?.(
      new LogEntry(
        new Date(),
        'info',
        `Template created with ID: ${templateID}, Build ID: ${buildID}`
      )
    )

    const instructionsWithHashes = this.calculateFilesHashes()

    // Prepare file uploads
    const fileUploads = instructionsWithHashes
      .filter((instruction) => instruction.type === 'COPY')
      .map((instruction) => ({
        src: instruction.args[0],
        dest: instruction.args[1],
        filesHash: instruction.filesHash,
        forceUpload: instruction.forceUpload,
      }))

    // Upload files in parallel
    const uploadPromises = fileUploads.map(async (file) => {
      const { present, url } = await getFileUploadLink(client, {
        templateID,
        filesHash: file.filesHash!,
      })

      if (
        (file.forceUpload && url != null) ||
        (present === false && url != null)
      ) {
        await uploadFile({
          fileName: file.src,
          fileContextPath: this.fileContextPath,
          url,
        })
        options.onBuildLogs?.(
          new LogEntry(new Date(), 'info', `Uploaded '${file.src}'`)
        )
      } else {
        options.onBuildLogs?.(
          new LogEntry(
            new Date(),
            'info',
            `Skipping upload of '${file.src}', already cached`
          )
        )
      }
    })

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

    await this.waitForBuildFinish(client, {
      templateID,
      buildID,
      onBuildLogs: options.onBuildLogs,
    })
  }

  // We might no longer need this as we move the logic server-side
  private calculateFilesHashes(): Steps[] {
    const steps: Steps[] = []

    for (const instruction of this.instructions) {
      if (instruction.type === 'COPY') {
        const filesHash = calculateFilesHash(
          instruction.args[0],
          instruction.args[1],
          this.fileContextPath,
          [
            ...this.ignoreFilePaths,
            ...(runtime === 'browser'
              ? []
              : readDockerignore(this.fileContextPath)),
          ]
        )
        steps.push({ ...instruction, filesHash })
      } else {
        steps.push(instruction)
      }
    }

    return steps
  }

  private async waitForBuildFinish(
    client: ApiClient,
    {
      templateID,
      buildID,
      onBuildLogs,
    }: {
      templateID: string
      buildID: string
      onBuildLogs?: (logEntry: InstanceType<typeof LogEntry>) => void
    }
  ): Promise<void> {
    let logsOffset = 0
    let status: GetBuildStatusResponse['status'] = 'building'

    while (status === 'building') {
      const buildStatus = await getBuildStatus(client, {
        templateID,
        buildID,
        logsOffset,
      })

      logsOffset += buildStatus.logEntries.length

      buildStatus.logEntries.forEach(
        (logEntry: GetBuildStatusResponse['logEntries'][number]) =>
          onBuildLogs?.(
            new LogEntry(
              new Date(logEntry.timestamp),
              logEntry.level,
              stripAnsi(logEntry.message)
            )
          )
      )

      status = buildStatus.status
      switch (status) {
        case 'ready': {
          return
        }
        case 'error': {
          throw new BuildError(buildStatus?.reason?.message ?? 'Unknown error')
        }
      }

      // Wait for a short period before checking the status again
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    throw new BuildError('Unknown build error occurred.')
  }

  private serialize(steps: Steps[]): TriggerBuildTemplate {
    const baseData = {
      startCmd: this.startCmd,
      readyCmd: this.readyCmd,
      steps,
      force: this.force,
    }

    if (this.baseImage !== undefined) {
      return {
        ...baseData,
        fromImage: this.baseImage,
      }
    } else if (this.baseTemplate !== undefined) {
      return {
        ...baseData,
        fromTemplate: this.baseTemplate,
      }
    } else {
      throw new BuildError(
        'Template must specify either fromImage or fromTemplate'
      )
    }
  }
}

// Factory function to create Template instances without 'new'
export function Template(options?: TemplateOptions): TemplateFromImage {
  return new TemplateClass(options)
}

export function defineConfig(
  options: BuildOptions & { template: TemplateClass }
): BuildOptions {
  return options
}

export function waitForPort(port: number) {
  return `ss -tuln | grep :${port}`
}

export function waitForURL(url: string, statusCode: number = 200) {
  return `curl -s -o /dev/null -w "%{http_code}" ${url} | grep -q "${statusCode}"`
}

export function waitForProcess(processName: string) {
  return `pgrep ${processName} > /dev/null`
}

export function waitForFile(filename: string) {
  return `[ -f ${filename} ]`
}

export function waitForTimeout(timeout: number | Duration) {
  return `sleep ${timeout}`
}

Template.build = TemplateClass.build
Template.toJSON = TemplateClass.toJSON
Template.toDockerfile = TemplateClass.toDockerfile
