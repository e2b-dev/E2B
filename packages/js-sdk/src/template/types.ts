import { stripAnsi } from '../utils'
import { ReadyCmd } from './readycmd'

export enum InstructionType {
  COPY = 'COPY',
  ENV = 'ENV',
  RUN = 'RUN',
  WORKDIR = 'WORKDIR',
  USER = 'USER',
}

export type Instruction = {
  type: InstructionType
  args: string[]
  force: boolean
  forceUpload?: boolean
  filesHash?: string
  resolveSymlinks?: boolean
}

export type CopyItem = {
  src: string
  dest: string
  forceUpload?: boolean
  user?: string
  mode?: number
  resolveSymlinks?: boolean
}

// Interface for the initial state
export interface TemplateFromImage {
  fromDebianImage(variant?: string): TemplateBuilder

  fromUbuntuImage(variant?: string): TemplateBuilder

  fromPythonImage(version?: string): TemplateBuilder

  fromNodeImage(variant?: string): TemplateBuilder

  fromBaseImage(): TemplateBuilder

  fromImage(baseImage: string): TemplateBuilder

  fromTemplate(template: string): TemplateBuilder

  fromDockerfile(dockerfileContent: string): TemplateBuilder

  fromRegistry(
    image: string,
    options: {
      username: string
      password: string
    }
  ): TemplateBuilder

  fromAWSRegistry(
    image: string,
    options: {
      accessKeyId: string
      secretAccessKey: string
      region: string
    }
  ): TemplateBuilder

  fromGCPRegistry(
    image: string,
    options: {
      serviceAccountJSON: object | string
    }
  ): TemplateBuilder

  skipCache(): TemplateBuilder
}

// Interface for the main builder state
export interface TemplateBuilder {
  copy(
    src: string,
    dest: string,
    options?: {
      forceUpload?: true
      user?: string
      mode?: number
      resolveSymlinks?: boolean
    }
  ): TemplateBuilder

  copy(items: CopyItem[]): TemplateBuilder

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

  runCmd(
    commandOrCommands: string | string[],
    options?: { user?: string }
  ): TemplateBuilder

  setWorkdir(workdir: string): TemplateBuilder

  setUser(user: string): TemplateBuilder

  pipInstall(packages?: string | string[]): TemplateBuilder

  npmInstall(packages?: string | string[], g?: boolean): TemplateBuilder

  aptInstall(packages: string | string[]): TemplateBuilder

  gitClone(
    url: string,
    path?: string,
    options?: { branch?: string; depth?: number }
  ): TemplateBuilder

  setEnvs(envs: Record<string, string>): TemplateBuilder

  skipCache(): TemplateBuilder

  setStartCmd(
    startCommand: string,
    readyCommand: string | ReadyCmd
  ): TemplateFinal

  setReadyCmd(readyCommand: string | ReadyCmd): TemplateFinal
}

// Interface for the final state
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TemplateFinal {}

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

export type GenericDockerRegistry = {
  type: 'registry'
  username: string
  password: string
}

export type AWSRegistry = {
  type: 'aws'
  awsAccessKeyId: string
  awsSecretAccessKey: string
  awsRegion: string
}

export type GCPRegistry = {
  type: 'gcp'
  serviceAccountJson: string
}

export type RegistryConfig = GenericDockerRegistry | AWSRegistry | GCPRegistry
