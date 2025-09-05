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
import { CopyItem, Instruction, LogEntry, TemplateType } from './types'
import { calculateFilesHash, getCallerDirectory, padOctal, readDockerignore } from './utils'
import { ConnectionConfig } from '../connectionConfig'

const logsRefreshFrequency: number = 200

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

class BuilderState {
  // Internal computation state
  forceNextLayer: boolean = false

  // Base phase
  baseImage: string | undefined = undefined
  baseTemplate: string | undefined = undefined
  force: boolean = false

  // Steps phase
  instructions: Instruction[] = []

  // Final phase
  startCmd: string | undefined = undefined
  readyCmd: string | undefined = undefined

  // Build metadata
  fileContextPath: string =
    runtime === 'browser' ? '.' : getCallerDirectory() ?? '.'
  ignoreFilePaths: string[] = []

  public async calculateFilesHashes(): Promise<void> {
    const steps: Instruction[] = []

    for (const instruction of this.instructions) {
      const step: Instruction = {
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
          ],
        )
      }

      steps.push(step)
    }

    this.instructions = steps
  }

  public serialize(): TriggerBuildTemplate {
    const templateData: TemplateType = {
      steps: this.instructions,
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

export interface TemplateClass {
  getState(): BuilderState
}

export class TemplateBuilder implements TemplateClass {
  constructor(private state: BuilderState) {
  }

  getState(): BuilderState {
    return this.state
  }

  copy(
    src: string,
    dest: string,
    options?: { forceUpload?: true; user?: string; mode?: number },
  ): TemplateBuilder
  copy(
    items: CopyItem[],
    options?: { forceUpload?: true; user?: string; mode?: number },
  ): TemplateBuilder
  copy(
    srcOrItems: string | CopyItem[],
    destOrOptions?:
      | string
      | { forceUpload?: true; user?: string; mode?: number },
    options?: { forceUpload?: true; user?: string; mode?: number },
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
        force: item.forceUpload ?? this.state.forceNextLayer,
        forceUpload: item.forceUpload,
      }
      this.state.instructions.push(instruction)
    }
    return this
  }

  remove(
    path: string,
    options?: { force?: boolean; recursive?: boolean },
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
    options?: { force?: boolean },
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
    options?: { mode?: number },
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

  runCmd(command: string, options?: { user?: string }): TemplateBuilder
  runCmd(commands: string[], options?: { user?: string }): TemplateBuilder
  runCmd(
    commandOrCommands: string | string[],
    options?: { user?: string },
  ): TemplateBuilder {
    const cmds = Array.isArray(commandOrCommands)
      ? commandOrCommands
      : [commandOrCommands]

    const args = [cmds.join(' && ')]
    if (options?.user) {
      args.push(options.user)
    }

    this.state.instructions.push({
      type: 'RUN',
      args,
      force: this.state.forceNextLayer,
    })
    return this
  }

  setWorkdir(workdir: string): TemplateBuilder {
    const instruction: Instruction = {
      type: 'WORKDIR',
      args: [workdir],
      force: this.state.forceNextLayer,
    }
    this.state.instructions.push(instruction)
    return this
  }

  setUser(user: string): TemplateBuilder {
    const instruction: Instruction = {
      type: 'USER',
      args: [user],
      force: this.state.forceNextLayer,
    }
    this.state.instructions.push(instruction)
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
          ' ',
        )}`,
      ],
      { user: 'root' },
    )
  }

  gitClone(
    url: string,
    path?: string,
    options?: { branch?: string; depth?: number },
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
      force: this.state.forceNextLayer,
    }
    this.state.instructions.push(instruction)
    return this
  }

  skipCache(): TemplateBuilder {
    this.state.forceNextLayer = true
    return this
  }

  setStartCmd(startCmd: string, readyCmd: string): TemplateFinal {
    this.state.startCmd = startCmd
    this.state.readyCmd = readyCmd
    return new TemplateFinal(this.state)
  }

  setReadyCmd(readyCmd: string): TemplateFinal {
    this.state.readyCmd = readyCmd
    return new TemplateFinal(this.state)
  }
}

export class TemplateFinal implements TemplateClass {
  constructor(private state: BuilderState) {
  }

  getState(): BuilderState {
    return this.state
  }
}

export class TemplateBase {
  defaultBaseImage: string = 'e2bdev/base'

  state: BuilderState

  constructor(options?: TemplateOptions) {
    this.state = new BuilderState()

    if (options?.fileContextPath !== undefined) {
      this.state.fileContextPath = options.fileContextPath
    }
    if (options?.ignoreFilePaths !== undefined) {
      this.state.ignoreFilePaths = options.ignoreFilePaths
    }
  }

  // Public instance methods
  skipCache(): TemplateBase {
    this.state.forceNextLayer = true
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
    this.state.baseImage = baseImage
    this.state.baseTemplate = undefined

    // If we should force the next layer and it's a FROM command, invalidate whole template
    if (this.state.forceNextLayer) {
      this.state.force = true
    }

    return new TemplateBuilder(this.state)
  }

  fromTemplate(template: string): TemplateBuilder {
    this.state.baseTemplate = template
    this.state.baseImage = undefined

    // If we should force the next layer and it's a FROM command, invalidate whole template
    if (this.state.forceNextLayer) {
      this.state.force = true
    }

    return new TemplateBuilder(this.state)
  }

  fromDockerfile(dockerfileContentOrPath: string): TemplateBuilder {
    const templateBuilder = new TemplateBuilder(this.state)
    const { baseImage } = parseDockerfile(
      dockerfileContentOrPath,
      templateBuilder,
    )
    this.state.baseImage = baseImage
    this.state.baseTemplate = undefined

    // If we should force the next layer and it's a FROM command, invalidate whole template
    if (this.state.forceNextLayer) {
      this.state.force = true
    }

    return templateBuilder
  }
}

async function toJSON(template: TemplateClass): Promise<string> {
  const state = template.getState()
  await state.calculateFilesHashes()
  return JSON.stringify(
    state.serialize(),
    undefined,
    2,
  )
}

function toDockerfile(template: TemplateClass): string {
  const templateBase = template.getState()
  if (templateBase.baseTemplate !== undefined) {
    throw new Error(
      'Cannot convert template built from another template to Dockerfile. ' +
      'Templates based on other templates can only be built using the E2B API.',
    )
  }

  if (templateBase.baseImage === undefined) {
    throw new Error('No base image specified for template')
  }

  let dockerfile = `FROM ${templateBase.baseImage}\n`
  for (const instruction of templateBase.instructions) {
    dockerfile += `${instruction.type} ${instruction.args.join(' ')}\n`
  }
  if (templateBase.startCmd) {
    dockerfile += `ENTRYPOINT ${templateBase.startCmd}\n`
  }
  return dockerfile
}

async function build(
  template: TemplateClass,
  options: BuildOptions,
): Promise<void> {
  const config = new ConnectionConfig({
    domain: options.domain,
    apiKey: options.apiKey,
  })
  const client = new ApiClient(config)
  const state = template.getState()

  if (options.skipCache) {
    state.force = true
  }

  // Create template
  options.onBuildLogs?.(
    new LogEntry(
      new Date(),
      'info',
      `Requesting build for template: ${options.alias}`,
    ),
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
      `Template created with ID: ${templateID}, Build ID: ${buildID}`,
    ),
  )

  await state.calculateFilesHashes()

  // Prepare file uploads
  const fileUploads = state.instructions
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
        fileContextPath: state.fileContextPath,
        url,
      })
      options.onBuildLogs?.(
        new LogEntry(new Date(), 'info', `Uploaded '${file.src}'`),
      )
    } else {
      options.onBuildLogs?.(
        new LogEntry(
          new Date(),
          'info',
          `Skipping upload of '${file.src}', already cached`,
        ),
      )
    }
  })

  await Promise.all(uploadPromises)

  options.onBuildLogs?.(
    new LogEntry(new Date(), 'info', 'All file uploads completed'),
  )

  // Start build
  options.onBuildLogs?.(
    new LogEntry(new Date(), 'info', 'Starting building...'),
  )

  await triggerBuild(client, {
    templateID,
    buildID,
    template: state.serialize(),
  })

  options.onBuildLogs?.(
    new LogEntry(new Date(), 'info', 'Waiting for logs...'),
  )

  await waitForBuildFinish(client, {
    templateID,
    buildID,
    onBuildLogs: options.onBuildLogs,
    logsRefreshFrequency: logsRefreshFrequency,
  })
}

// Factory function to create Template instances without 'new'
export function Template(options?: TemplateOptions): TemplateBase {
  return new TemplateBase(options)
}

Template.build = build
Template.toJSON = toJSON
Template.toDockerfile = toDockerfile
Template.waitForPort = function(port: number) {
  return `ss -tuln | grep :${port}`
}

Template.waitForURL = function(url: string, statusCode: number = 200) {
  return `curl -s -o /dev/null -w "%{http_code}" ${url} | grep -q "${statusCode}"`
}

Template.waitForProcess = function(processName: string) {
  return `pgrep ${processName} > /dev/null`
}

Template.waitForFile = function(filename: string) {
  return `[ -f ${filename} ]`
}

Template.waitForTimeout = function(timeout: number) {
  // convert to seconds, but ensure minimum of 1 second
  const seconds = Math.max(1, Math.floor(timeout / 1000))
  return `sleep ${seconds}`
}
