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
import { parseDockerfile } from './dockerfileParser'
import { BuildError } from './errors'
import {
  Instruction,
  TemplateFromImage,
  TemplateBuilder,
  TemplateFinal,
  CopyItem,
  LogEntry,
} from './types'
import {
  calculateFilesHash,
  getCallerDirectory,
  padOctal,
  readDockerignore,
} from './utils'
import { ConnectionConfig } from '../connectionConfig'
import { ReadyCmd } from './readycmd'
import {
  RegistryConfig,
  GenericDockerRegistry,
  AWSRegistry,
  GCPRegistry,
} from './registry'

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
  private fileContextPath: string =
    runtime === 'browser' ? '.' : getCallerDirectory() ?? '.'
  private ignoreFilePaths: string[] = []
  private logsRefreshFrequency: number = 200

  constructor(options?: TemplateOptions) {
    this.fileContextPath = options?.fileContextPath ?? this.fileContextPath
    this.ignoreFilePaths = options?.ignoreFilePaths ?? this.ignoreFilePaths
  }

  static toJSON(template: TemplateClass): Promise<string> {
    return (template as TemplateBase).toJSON()
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

  fromDockerRegistry(
    image: string,
    username: string,
    password: string
  ): TemplateBuilder {
    this.baseImage = image
    this.baseTemplate = undefined
    this.registryConfig = new GenericDockerRegistry(username, password)

    // If we should force the next layer and it's a FROM command, invalidate whole template
    if (this.forceNextLayer) {
      this.force = true
    }

    return this
  }

  fromAWSRegistry(
    image: string,
    awsAccessKeyId: string,
    awsSecretAccessKey: string,
    awsRegion: string
  ): TemplateBuilder {
    this.baseImage = image
    this.baseTemplate = undefined
    this.registryConfig = new AWSRegistry(
      awsAccessKeyId,
      awsSecretAccessKey,
      awsRegion
    )

    // If we should force the next layer and it's a FROM command, invalidate whole template
    if (this.forceNextLayer) {
      this.force = true
    }

    return this
  }

  fromGCPRegistry(image: string, serviceAccountJson: object): TemplateBuilder {
    this.baseImage = image
    this.baseTemplate = undefined
    this.registryConfig = new GCPRegistry(serviceAccountJson)

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

      this.instructions.push({
        type: 'COPY',
        args,
        force: item.forceUpload ?? this.forceNextLayer,
        forceUpload: item.forceUpload,
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

    return this
  }

  setReadyCmd(readyCommand: string | ReadyCmd): TemplateFinal {
    if (readyCommand instanceof ReadyCmd) {
      this.readyCmd = readyCommand.getCmd()
    } else {
      this.readyCmd = readyCommand
    }

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

  private async toJSON(): Promise<string> {
    return JSON.stringify(
      this.serialize(await this.calculateFilesHashes()),
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

  // We might no longer need this as we move the logic server-side
  private async calculateFilesHashes(): Promise<Instruction[]> {
    const steps: Instruction[] = []

    for (const instruction of this.instructions) {
      if (instruction.type === 'COPY') {
        instruction.filesHash = await calculateFilesHash(
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

      steps.push(instruction)
    }

    return steps
  }

  private serialize(steps: Instruction[]): TriggerBuildTemplate {
    const baseData = {
      startCmd: this.startCmd,
      readyCmd: this.readyCmd,
      steps,
      force: this.force,
    }

    if (this.registryConfig !== undefined && this.baseImage !== undefined) {
      return {
        ...baseData,
        fromImage: this.baseImage,
        fromImageRegistry: this.registryConfig.toJSON(),
      }
    } else if (this.baseImage !== undefined) {
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
        'Template must specify either a base image or a base template'
      )
    }
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
export { BuildError, FileUploadError } from './errors'
export {
  waitForFile,
  waitForURL,
  waitForPort,
  waitForProcess,
  waitForTimeout,
} from './readycmd'
