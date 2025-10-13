import { ReadyCmd } from './readycmd'
import type { PathLike } from 'node:fs'
import type { LogEntry } from './logger'

/**
 * Options for creating a new template.
 */
export type TemplateOptions = {
  /**
   * Path to the directory containing files to be copied into the template.
   * @default Current directory from template location
   */
  fileContextPath?: PathLike
  /**
   * Array of glob patterns to ignore when copying files.
   */
  fileIgnorePatterns?: string[]
}

/**
 * Basic options for building a template.
 */
export type BasicBuildOptions = {
  /**
   * Alias name for the template.
   */
  alias: string
  /**
   * Number of CPUs allocated to the sandbox.
   * @default 2
   */
  cpuCount?: number
  /**
   * Amount of memory in MB allocated to the sandbox.
   * @default 1024
   */
  memoryMB?: number
  /**
   * If true, skips cache and forces a complete rebuild.
   * @default false
   */
  skipCache?: boolean
  /**
   * Callback function to receive build logs during the build process.
   */
  onBuildLogs?: (logEntry: LogEntry) => void
}

/**
 * Options for building a template with authentication.
 */
export type BuildOptions = BasicBuildOptions & {
  /**
   * E2B API key for authentication.
   */
  apiKey?: string
  /**
   * Domain of the E2B API.
   */
  domain?: string
}

/**
 * Types of instructions that can be used in a template.
 */
export enum InstructionType {
  /** Copy files or directories into the template */
  COPY = 'COPY',
  /** Set environment variables */
  ENV = 'ENV',
  /** Run a command */
  RUN = 'RUN',
  /** Set the working directory */
  WORKDIR = 'WORKDIR',
  /** Set the user */
  USER = 'USER',
}

/**
 * Represents a single instruction in the template build process.
 */
export type Instruction = {
  /** Type of instruction */
  type: InstructionType
  /** Arguments for the instruction */
  args: string[]
  /** Whether to force rebuild of this layer */
  force: boolean
  /** Whether to force file upload (for COPY instructions) */
  forceUpload?: true
  /** Hash of files being copied (for COPY instructions) */
  filesHash?: string
  /** Whether to resolve symlinks when copying files */
  resolveSymlinks?: boolean
}

/**
 * Configuration for a single file/directory copy operation.
 */
export type CopyItem = {
  /** Source path(s) to copy from */
  src: PathLike | PathLike[]
  /** Destination path to copy to */
  dest: PathLike
  /** Whether to force file upload even if cached */
  forceUpload?: true
  /** Owner user for the copied files */
  user?: string
  /** Unix file permissions */
  mode?: number
  /** Whether to resolve symbolic links */
  resolveSymlinks?: boolean
}

/**
 * Initial state of a template builder.
 * Use one of these methods to specify the base image or template to start from.
 */
export interface TemplateFromImage {
  /**
   * Start from a Debian-based Docker image.
   * @param variant Debian variant (default: 'slim')
   *
   * @example
   * ```ts
   * template.fromDebianImage('bookworm-slim')
   * ```
   */
  fromDebianImage(variant?: string): TemplateBuilder

  /**
   * Start from an Ubuntu-based Docker image.
   * @param variant Ubuntu variant (default: 'lts')
   *
   * @example
   * ```ts
   * template.fromUbuntuImage('22.04')
   * ```
   */
  fromUbuntuImage(variant?: string): TemplateBuilder

  /**
   * Start from a Python-based Docker image.
   * @param version Python version (default: '3.13')
   *
   * @example
   * ```ts
   * template.fromPythonImage('3.11')
   * ```
   */
  fromPythonImage(version?: string): TemplateBuilder

  /**
   * Start from a Node.js-based Docker image.
   * @param variant Node.js variant (default: 'lts')
   *
   * @example
   * ```ts
   * template.fromNodeImage('20')
   * ```
   */
  fromNodeImage(variant?: string): TemplateBuilder

  /**
   * Start from E2B's default base image (e2bdev/base).
   *
   * @example
   * ```ts
   * template.fromBaseImage()
   * ```
   */
  fromBaseImage(): TemplateBuilder

  /**
   * Start from a custom Docker image.
   * @param baseImage Docker image name
   * @param credentials Optional credentials for private registries
   *
   * @example
   * ```ts
   * template.fromImage('python:3.11-slim')
   * template.fromImage('myregistry.com/myimage:latest', {
   *   username: 'user',
   *   password: 'pass'
   * })
   * ```
   */
  fromImage(
    baseImage: string,
    credentials?: { username: string; password: string }
  ): TemplateBuilder

  /**
   * Start from an existing E2B template.
   * @param template E2B template ID or alias
   *
   * @example
   * ```ts
   * template.fromTemplate('my-base-template')
   * ```
   */
  fromTemplate(template: string): TemplateBuilder

  /**
   * Parse a Dockerfile and convert it to Template SDK format.
   * @param dockerfileContentOrPath Dockerfile content or path
   *
   * @example
   * ```ts
   * template.fromDockerfile('Dockerfile')
   * template.fromDockerfile('FROM python:3.11\nRUN pip install numpy')
   * ```
   */
  fromDockerfile(dockerfileContentOrPath: string): TemplateBuilder

  /**
   * Start from a Docker image in AWS ECR.
   * @param image Full ECR image path
   * @param credentials AWS credentials
   *
   * @example
   * ```ts
   * template.fromAWSRegistry(
   *   '123456789.dkr.ecr.us-west-2.amazonaws.com/myimage:latest',
   *   {
   *     accessKeyId: 'AKIA...',
   *     secretAccessKey: '...',
   *     region: 'us-west-2'
   *   }
   * )
   * ```
   */
  fromAWSRegistry(
    image: string,
    credentials: {
      accessKeyId: string
      secretAccessKey: string
      region: string
    }
  ): TemplateBuilder

  /**
   * Start from a Docker image in Google Container Registry.
   * @param image Full GCR/GAR image path
   * @param credentials GCP service account credentials
   *
   * @example
   * ```ts
   * template.fromGCPRegistry(
   *   'gcr.io/myproject/myimage:latest',
   *   { serviceAccountJSON: 'path/to/service-account.json' }
   * )
   * ```
   */
  fromGCPRegistry(
    image: string,
    credentials: {
      serviceAccountJSON: object | string
    }
  ): TemplateBuilder

  /**
   * Skip cache for all subsequent build instructions from this point.
   *
   * When called before a from instruction, this forces the entire template
   * to be rebuilt from scratch. When called before other instructions, it
   * forces all subsequent layers to be rebuilt, ignoring any cached layers.
   *
   * @example
   * ```ts
   * template.skipCache().fromPythonImage('3.11')
   * ```
   */
  skipCache(): this
}

/**
 * Main builder state for constructing templates.
 * Provides methods for customizing the template environment.
 */
export interface TemplateBuilder {
  /**
   * Copy files or directories into the template.
   * @param src Source path(s)
   * @param dest Destination path
   * @param options Copy options
   *
   * @example
   * ```ts
   * template.copy('requirements.txt', '/home/user/')
   * template.copy(['app.ts', 'config.ts'], '/app/', { mode: 0o755 })
   * ```
   */
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

  /**
   * Copy multiple items with individual options.
   * @param items Array of copy items
   *
   * @example
   * ```ts
   * template.copyItems([
   *   { src: 'app.ts', dest: '/app/' },
   *   { src: 'config.ts', dest: '/app/', mode: 0o644 }
   * ])
   * ```
   */
  copyItems(items: CopyItem[]): TemplateBuilder

  /**
   * Remove files or directories.
   * @param path Path(s) to remove
   * @param options Remove options
   *
   * @example
   * ```ts
   * template.remove('/tmp/cache', { recursive: true, force: true })
   * ```
   */
  remove(
    path: PathLike | PathLike[],
    options?: { force?: boolean; recursive?: boolean }
  ): TemplateBuilder

  /**
   * Rename or move a file or directory.
   * @param src Source path
   * @param dest Destination path
   * @param options Rename options
   *
   * @example
   * ```ts
   * template.rename('/tmp/old.txt', '/tmp/new.txt')
   * ```
   */
  rename(
    src: PathLike,
    dest: PathLike,
    options?: { force?: boolean }
  ): TemplateBuilder

  /**
   * Create directories.
   * @param path Directory path(s)
   * @param options Directory options
   *
   * @example
   * ```ts
   * template.makeDir('/app/data', { mode: 0o755 })
   * template.makeDir(['/app/logs', '/app/cache'])
   * ```
   */
  makeDir(
    path: PathLike | PathLike[],
    options?: { mode?: number }
  ): TemplateBuilder

  /**
   * Create a symbolic link.
   * @param src Source path (target)
   * @param dest Destination path (symlink location)
   *
   * @example
   * ```ts
   * template.makeSymlink('/usr/bin/python3', '/usr/bin/python')
   * ```
   */
  makeSymlink(src: PathLike, dest: PathLike): TemplateBuilder

  /**
   * Run a shell command.
   * @param command Command string
   * @param options Command options
   *
   * @example
   * ```ts
   * template.runCmd('apt-get update')
   * template.runCmd(['pip install numpy', 'pip install pandas'])
   * template.runCmd('apt-get install vim', { user: 'root' })
   * ```
   */
  runCmd(command: string, options?: { user?: string }): TemplateBuilder

  /**
   * Run multiple shell commands.
   * @param commands Array of command strings
   * @param options Command options
   */
  runCmd(commands: string[], options?: { user?: string }): TemplateBuilder

  /**
   * Run command(s).
   * @param commandOrCommands Command or commands
   * @param options Command options
   */
  runCmd(
    commandOrCommands: string | string[],
    options?: { user?: string }
  ): TemplateBuilder

  /**
   * Set the working directory.
   * @param workdir Working directory path
   *
   * @example
   * ```ts
   * template.setWorkdir('/app')
   * ```
   */
  setWorkdir(workdir: PathLike): TemplateBuilder

  /**
   * Set the user for subsequent commands.
   * @param user Username
   *
   * @example
   * ```ts
   * template.setUser('root')
   * ```
   */
  setUser(user: string): TemplateBuilder

  /**
   * Install Python packages using pip.
   * @param packages Package name(s) or undefined for current directory
   *
   * @example
   * ```ts
   * template.pipInstall('numpy')
   * template.pipInstall(['pandas', 'scikit-learn'])
   * template.pipInstall()  // Installs from current directory
   * ```
   */
  pipInstall(packages?: string | string[]): TemplateBuilder

  /**
   * Install Node.js packages using npm.
   * @param packages Package name(s) or undefined for package.json
   * @param options Install options
   *
   * @example
   * ```ts
   * template.npmInstall('express')
   * template.npmInstall(['lodash', 'axios'])
   * template.npmInstall('typescript', { g: true })
   * template.npmInstall()  // Installs from package.json
   * ```
   */
  npmInstall(
    packages?: string | string[],
    options?: { g?: boolean }
  ): TemplateBuilder

  /**
   * Install Debian/Ubuntu packages using apt-get.
   * @param packages Package name(s)
   *
   * @example
   * ```ts
   * template.aptInstall('vim')
   * template.aptInstall(['git', 'curl', 'wget'])
   * ```
   */
  aptInstall(packages: string | string[]): TemplateBuilder

  /**
   * Clone a Git repository.
   * @param url Repository URL
   * @param path Optional destination path
   * @param options Clone options
   *
   * @example
   * ```ts
   * template.gitClone('https://github.com/user/repo.git', '/app/repo')
   * template.gitClone('https://github.com/user/repo.git', undefined, {
   *   branch: 'main',
   *   depth: 1
   * })
   * ```
   */
  gitClone(
    url: string,
    path?: PathLike,
    options?: { branch?: string; depth?: number }
  ): TemplateBuilder

  /**
   * Set environment variables.
   * @param envs Environment variables
   *
   * @example
   * ```ts
   * template.setEnvs({ NODE_ENV: 'production', PORT: '8080' })
   * ```
   */
  setEnvs(envs: Record<string, string>): TemplateBuilder

  /**
   * Skip cache for all subsequent build instructions from this point.
   *
   * Call this before any instruction to force it and all following layers
   * to be rebuilt, ignoring any cached layers.
   *
   * @example
   * ```ts
   * template.skipCache().runCmd('apt-get update')
   * ```
   */
  skipCache(): this

  /**
   * Set the start command and ready check.
   * @param startCommand Command to run on startup
   * @param readyCommand Command to check readiness
   *
   * @example
   * ```ts
   * template.setStartCmd(
   *   'node app.js',
   *   'curl http://localhost:8000/health'
   * )
   * ```
   */
  setStartCmd(
    startCommand: string,
    readyCommand: string | ReadyCmd
  ): TemplateFinal

  /**
   * Set or update the ready check command.
   * @param readyCommand Command to check readiness
   *
   * @example
   * ```ts
   * template.setReadyCmd('curl http://localhost:8000/health')
   * ```
   */
  setReadyCmd(readyCommand: string | ReadyCmd): TemplateFinal
}

/**
 * Final state of a template after start/ready commands are set.
 * The template can only be built in this state.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TemplateFinal {}

/**
 * Configuration for a generic Docker registry with basic authentication.
 */
export type GenericDockerRegistry = {
  /** Registry type identifier */
  type: 'registry'
  /** Registry username */
  username: string
  /** Registry password */
  password: string
}

/**
 * Configuration for AWS Elastic Container Registry (ECR).
 */
export type AWSRegistry = {
  /** Registry type identifier */
  type: 'aws'
  /** AWS access key ID */
  awsAccessKeyId: string
  /** AWS secret access key */
  awsSecretAccessKey: string
  /** AWS region */
  awsRegion: string
}

/**
 * Configuration for Google Container Registry (GCR) or Artifact Registry.
 */
export type GCPRegistry = {
  /** Registry type identifier */
  type: 'gcp'
  /** Service account JSON as string */
  serviceAccountJson: string
}

/**
 * Union type for all supported container registry configurations.
 */
export type RegistryConfig = GenericDockerRegistry | AWSRegistry | GCPRegistry

/**
 * Type representing a template in any state (builder or final).
 */
export type TemplateClass = TemplateBuilder | TemplateFinal
