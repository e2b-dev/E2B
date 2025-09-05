import { ApiClient } from '../api'
import { runtime } from '../utils'
import {
  getFileUploadLink,
  requestBuild,
  triggerBuild,
  TriggerBuildTemplate,
  uploadFile,
  waitForBuildFinish,
} from './buildApi'
import { parseDockerfile, DockerfileParserInterface } from './dockerfileParser'
import { Instruction, Step, CopyItem, TemplateType } from './types'
import {
  calculateFilesHash,
  getCallerDirectory,
  padOctal,
  readDockerignore,
} from './utils'
import { ConnectionConfig } from '../connectionConfig'
import { LogEntry } from './types'

type TemplateOptions = {
  fileContextPath?: string
  ignoreFilePaths?: string[]
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

export class TemplateBuilder {
  constructor(private template: TemplateBase) {}

  getTemplateBase(): TemplateBase {
    return this.template
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
      : [
          {
            src: srcOrItems,
            dest: destOrOptions as string,
            mode: options?.mode,
            user: options?.user,
            forceUpload: options?.forceUpload,
          },
        ]

    for (const item of items) {
      const args = [
        item.src,
        item.dest,
        item.user ?? '',
        item.mode ? padOctal(item.mode) : '',
      ]

      const instruction: Instruction = {
        type: 'COPY',
        args,
        force: item.forceUpload ?? this.template.forceNextLayer,
        forceUpload: item.forceUpload,
      }
      this.template.instructions.push(instruction)
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
    const pathList = Array.isArray(paths) ? paths : [paths]
    const args = ['mkdir', '-p', ...pathList]
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

  runCmd(
    commandOrCommands: string | string[],
    options?: { user?: string }
  ): TemplateBuilder {
    const commands = Array.isArray(commandOrCommands)
      ? commandOrCommands
      : [commandOrCommands]
    const args = [commands.join(' && ')]

    if (options?.user) {
      args.push(options.user)
    }

    const instruction: Instruction = {
      type: 'RUN',
      args,
      force: this.template.forceNextLayer,
    }
    this.template.instructions.push(instruction)
    return this
  }

  setWorkdir(workdir: string): TemplateBuilder {
    const instruction: Instruction = {
      type: 'WORKDIR',
      args: [workdir],
      force: this.template.forceNextLayer,
    }
    this.template.instructions.push(instruction)
    return this
  }

  setUser(user: string): TemplateBuilder {
    const instruction: Instruction = {
      type: 'USER',
      args: [user],
      force: this.template.forceNextLayer,
    }
    this.template.instructions.push(instruction)
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
    return this.runCmd(args)
  }

  npmInstall(packages?: string | string[], g?: boolean): TemplateBuilder {
    const args = ['npm', 'install']
    const packageList = packages
      ? Array.isArray(packages)
        ? packages
        : [packages]
      : undefined
    if (packageList) {
      args.push(...packageList)
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
    path?: string,
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

  setEnvs(envs: Record<string, string>): TemplateBuilder {
    if (Object.keys(envs).length === 0) {
      return this
    }

    const instruction: Instruction = {
      type: 'ENV',
      args: Object.entries(envs).flatMap(([key, value]) => [key, value]),
      force: this.template.forceNextLayer,
    }
    this.template.instructions.push(instruction)
    return this
  }

  skipCache(): TemplateBuilder {
    this.template.forceNextLayer = true
    return this
  }

  setStartCmd(startCmd: string, readyCmd: string): TemplateFinal {
    this.template.startCmd = startCmd
    this.template.readyCmd = readyCmd
    return new TemplateFinal(this.template)
  }

  setReadyCmd(readyCmd: string): TemplateFinal {
    this.template.readyCmd = readyCmd
    return new TemplateFinal(this.template)
  }
}

export class TemplateFinal {
  constructor(private template: TemplateBase) {}

  getTemplateBase(): TemplateBase {
    return this.template
  }
}

export class TemplateBase {
  // Public instance fields
  public startCmd: string | undefined = undefined
  public readyCmd: string | undefined = undefined
  public forceNextLayer: boolean = false
  public instructions: Instruction[] = []

  // Private instance fields
  private defaultBaseImage: string = 'e2bdev/base'
  private baseImage: string | undefined = this.defaultBaseImage
  private baseTemplate: string | undefined = undefined
  // Force the whole template to be rebuilt
  private force: boolean = false
  private fileContextPath: string =
    runtime === 'browser' ? '.' : getCallerDirectory() ?? '.'
  private ignoreFilePaths: string[] = []
  private logsRefreshFrequency: number = 200

  constructor(options?: TemplateOptions) {
    this.fileContextPath = options?.fileContextPath ?? this.fileContextPath
    this.ignoreFilePaths = options?.ignoreFilePaths ?? this.ignoreFilePaths
  }

  // Static methods
  static toJSON(template: TemplateClass): Promise<string> {
    return template.getTemplateBase().toJSON()
  }

  static toDockerfile(template: TemplateClass): string {
    return template.getTemplateBase().toDockerfile()
  }

  static build(template: TemplateClass, options: BuildOptions): Promise<void> {
    return template.getTemplateBase().build(options)
  }

  static waitForPort(port: number): string {
    return `ss -tuln | grep :${port}`
  }

  static waitForURL(url: string, statusCode: number = 200): string {
    return `curl -s -o /dev/null -w "%{http_code}" ${url} | grep -q "${statusCode}"`
  }

  static waitForProcess(processName: string): string {
    return `pgrep ${processName} > /dev/null`
  }

  static waitForFile(filename: string): string {
    return `[ -f ${filename} ]`
  }

  static waitForTimeout(timeout: number): string {
    // convert to seconds, but ensure minimum of 1 second
    const seconds = Math.max(1, Math.floor(timeout / 1000))
    return `sleep ${seconds}`
  }

  // Public instance methods
  skipCache(): TemplateBase {
    this.forceNextLayer = true
    return this
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

  fromImage(baseImage: string): TemplateBuilder {
    this.baseImage = baseImage
    this.baseTemplate = undefined

    // If we should force the next layer and it's a FROM command, invalidate whole template
    if (this.forceNextLayer) {
      this.force = true
    }

    return new TemplateBuilder(this)
  }

  fromTemplate(template: string): TemplateBuilder {
    this.baseTemplate = template
    this.baseImage = undefined

    // If we should force the next layer and it's a FROM command, invalidate whole template
    if (this.forceNextLayer) {
      this.force = true
    }

    return new TemplateBuilder(this)
  }

  fromDockerfile(dockerfileContentOrPath: string): TemplateBuilder {
    const { baseImage } = parseDockerfile(dockerfileContentOrPath, this)
    this.baseImage = baseImage
    this.baseTemplate = undefined

    // If we should force the next layer and it's a FROM command, invalidate whole template
    if (this.forceNextLayer) {
      this.force = true
    }

    return new TemplateBuilder(this)
  }

  // DockerfileParserInterface implementation
  setWorkdir(workdir: string): DockerfileParserInterface {
    this.instructions.push({
      type: 'WORKDIR',
      args: [workdir],
      force: this.forceNextLayer,
    })
    return this
  }

  setUser(user: string): DockerfileParserInterface {
    this.instructions.push({
      type: 'USER',
      args: [user],
      force: this.forceNextLayer,
    })
    return this
  }

  setEnvs(envs: Record<string, string>): DockerfileParserInterface {
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

  runCmd(command: string): DockerfileParserInterface {
    this.instructions.push({
      type: 'RUN',
      args: [command],
      force: this.forceNextLayer,
    })
    return this
  }

  copy(src: string, dest: string): DockerfileParserInterface {
    this.instructions.push({
      type: 'COPY',
      args: [src, dest, '', ''],
      force: this.forceNextLayer,
    })
    return this
  }

  setStartCmd(startCommand: string, readyCommand: string): TemplateFinal {
    this.startCmd = startCommand
    this.readyCmd = readyCommand
    return new TemplateFinal(this)
  }

  protected async toJSON(): Promise<string> {
    return JSON.stringify(
      this.serialize(await this.calculateFilesHashes()),
      undefined,
      2
    )
  }

  protected toDockerfile(): string {
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

  protected async build(options: BuildOptions): Promise<void> {
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

    const instructionsWithHashes = await this.calculateFilesHashes()

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

    await waitForBuildFinish(client, {
      templateID,
      buildID,
      onBuildLogs: options.onBuildLogs,
      logsRefreshFrequency: this.logsRefreshFrequency,
    })
  }

  public async calculateFilesHashes(): Promise<Step[]> {
    const steps: Step[] = []

    for (const instruction of this.instructions) {
      const step: Step = {
        type: instruction.type,
        args: instruction.args,
        force: instruction.force,
        forceUpload: instruction.forceUpload,
      }

      if (instruction.type === 'COPY') {
        step.filesHash = await calculateFilesHash(
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
      }

      steps.push(step)
    }

    return steps
  }

  public serialize(steps: Step[]): TriggerBuildTemplate {
    const templateData: TemplateType = {
      steps,
      force: this.force,
    }

    if (this.baseImage !== undefined) {
      templateData.fromImage = this.baseImage
    }

    if (this.baseTemplate !== undefined) {
      templateData.fromTemplate = this.baseTemplate
    }

    if (this.startCmd !== undefined) {
      templateData.startCmd = this.startCmd
    }

    if (this.readyCmd !== undefined) {
      templateData.readyCmd = this.readyCmd
    }

    return templateData as TriggerBuildTemplate
  }
}

// Factory function to create Template instances without 'new'
export function Template(options?: TemplateOptions): TemplateBase {
  return new TemplateBase(options)
}

Template.build = TemplateBase.build
Template.toJSON = TemplateBase.toJSON
Template.toDockerfile = TemplateBase.toDockerfile
Template.waitForPort = TemplateBase.waitForPort
Template.waitForURL = TemplateBase.waitForURL
Template.waitForProcess = TemplateBase.waitForProcess
Template.waitForFile = TemplateBase.waitForFile
Template.waitForTimeout = TemplateBase.waitForTimeout

export type TemplateClass = TemplateBuilder | TemplateFinal
