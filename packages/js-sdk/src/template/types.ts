import { ReadyCmd } from './readycmd'
import type { PathLike } from 'node:fs'

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
  forceUpload?: true
  filesHash?: string
  resolveSymlinks?: boolean
}

export type CopyItem = {
  src: PathLike | PathLike[]
  dest: PathLike
  forceUpload?: true
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

  fromImage(
    baseImage: string,
    credentials?: { username: string; password: string }
  ): TemplateBuilder

  fromTemplate(template: string): TemplateBuilder

  fromDockerfile(dockerfileContent: string): TemplateBuilder

  fromAWSRegistry(
    image: string,
    credentials: {
      accessKeyId: string
      secretAccessKey: string
      region: string
    }
  ): TemplateBuilder

  fromGCPRegistry(
    image: string,
    credentials: {
      serviceAccountJSON: object | string
    }
  ): TemplateBuilder

  skipCache(): TemplateBuilder
}

// Interface for the main builder state
export interface TemplateBuilder {
  copy(
    src: PathLike | PathLike[],
    dest: PathLike,
    options?: {
      forceUpload?: true
      user?: string
      mode?: number
      resolveSymlinks?: boolean
    }
  ): TemplateBuilder

  copyItems(items: CopyItem[]): TemplateBuilder

  remove(
    path: PathLike | PathLike[],
    options?: { force?: boolean; recursive?: boolean }
  ): TemplateBuilder

  rename(
    src: PathLike,
    dest: PathLike,
    options?: { force?: boolean }
  ): TemplateBuilder

  makeDir(
    path: PathLike | PathLike[],
    options?: { mode?: number }
  ): TemplateBuilder

  makeSymlink(src: PathLike, dest: PathLike): TemplateBuilder

  runCmd(command: string, options?: { user?: string }): TemplateBuilder

  runCmd(commands: string[], options?: { user?: string }): TemplateBuilder

  runCmd(
    commandOrCommands: string | string[],
    options?: { user?: string }
  ): TemplateBuilder

  setWorkdir(workdir: PathLike): TemplateBuilder

  setUser(user: string): TemplateBuilder

  pipInstall(packages?: string | string[]): TemplateBuilder

  npmInstall(
    packages?: string | string[],
    options?: { g?: boolean }
  ): TemplateBuilder

  aptInstall(packages: string | string[]): TemplateBuilder

  gitClone(
    url: string,
    path?: PathLike,
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
