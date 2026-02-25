import { CopyItem } from './types'
import {
  Argument,
  DockerfileParser,
  Instruction as DockerfileInstruction,
  ModifiableInstruction,
} from 'dockerfile-ast'
import fs from 'node:fs'
import { ReadyCmd, waitForTimeout } from './readycmd'

export interface DockerfileParseResult {
  baseImage: string
}

interface DockerfileFinalParserInterface {}

export interface DockerfileParserInterface {
  setWorkdir(workdir: string): DockerfileParserInterface
  setUser(user: string): DockerfileParserInterface
  setEnvs(envs: Record<string, string>): DockerfileParserInterface
  runCmd(
    commandOrCommands: string | string[],
    options?: { user?: string }
  ): DockerfileParserInterface
  copy(
    src: string,
    dest: string,
    options?: { forceUpload?: true; user?: string; mode?: number }
  ): DockerfileParserInterface
  copyItems(
    items: CopyItem[],
    options?: { forceUpload?: true; user?: string; mode?: number }
  ): DockerfileParserInterface
  setStartCmd(
    startCommand: string,
    readyCommand: string | ReadyCmd
  ): DockerfileFinalParserInterface
}

/**
 * Parse a Dockerfile and convert it to Template SDK format
 *
 * @param dockerfileContentOrPath Either the Dockerfile content as a string,
 *                                or a path to a Dockerfile file
 * @param templateBuilder Interface providing template builder methods
 * @returns Parsed Dockerfile result with base image and instructions
 */
export function parseDockerfile(
  dockerfileContentOrPath: string,
  templateBuilder: DockerfileParserInterface
): DockerfileParseResult {
  // Check if input is a file path that exists
  let dockerfileContent: string
  try {
    if (
      fs.existsSync(dockerfileContentOrPath) &&
      fs.statSync(dockerfileContentOrPath).isFile()
    ) {
      // Read the file content
      dockerfileContent = fs.readFileSync(dockerfileContentOrPath, 'utf-8')
    } else {
      // Treat as content directly
      dockerfileContent = dockerfileContentOrPath
    }
  } catch {
    // If there's any error checking the file, treat as content
    dockerfileContent = dockerfileContentOrPath
  }

  const dockerfile = DockerfileParser.parse(dockerfileContent)
  const instructions = dockerfile.getInstructions()

  // Check for multi-stage builds
  const fromInstructions = instructions.filter(
    (instruction) => instruction.getKeyword() === 'FROM'
  )

  if (fromInstructions.length > 1) {
    throw new Error('Multi-stage Dockerfiles are not supported')
  }

  if (fromInstructions.length === 0) {
    throw new Error('Dockerfile must contain a FROM instruction')
  }

  // Set the base image from the first FROM instruction
  const fromInstruction = fromInstructions[0]
  const argumentsData = fromInstruction.getArguments()
  let baseImage = 'e2bdev/base' // default fallback
  let userChanged = false
  let workdirChanged = false
  if (argumentsData && argumentsData.length > 0) {
    baseImage = argumentsData[0].getValue()
  }

  // Set the user and workdir to the Docker defaults
  templateBuilder.setUser('root')
  templateBuilder.setWorkdir('/')

  // Track resolved ENV values for variable expansion across instructions
  const envContext: Record<string, string> = {}

  // Process all other instructions
  for (const instruction of instructions) {
    const keyword = instruction.getKeyword()

    switch (keyword) {
      case 'FROM':
        // Already handled above
        break

      case 'RUN':
        handleRunInstruction(instruction, templateBuilder)
        break

      case 'COPY':
      case 'ADD':
        handleCopyInstruction(
          instruction as ModifiableInstruction,
          templateBuilder
        )
        break

      case 'WORKDIR':
        handleWorkdirInstruction(instruction, templateBuilder)
        workdirChanged = true
        break

      case 'USER':
        handleUserInstruction(instruction, templateBuilder)
        userChanged = true
        break

      case 'ENV':
      case 'ARG':
        handleEnvInstruction(instruction, templateBuilder, envContext)
        break

      case 'EXPOSE':
        // EXPOSE is not directly supported in our SDK, so we'll skip it
        break

      case 'VOLUME':
        // VOLUME is not directly supported in our SDK, so we'll skip it
        break

      case 'CMD':
      case 'ENTRYPOINT':
        handleCmdEntrypointInstruction(instruction, templateBuilder)
        break

      default:
        console.warn(`Unsupported instruction: ${keyword}`)
        break
    }
  }

  // Set the user and workdir to the E2B defaults
  if (!userChanged) {
    templateBuilder.setUser('user')
  }
  if (!workdirChanged) {
    templateBuilder.setWorkdir('/home/user')
  }

  return {
    baseImage,
  }
}

function handleRunInstruction(
  instruction: DockerfileInstruction,
  templateBuilder: DockerfileParserInterface
): void {
  const argumentsData = instruction.getArguments()
  if (argumentsData && argumentsData.length > 0) {
    const command = argumentsData
      .map((arg: Argument) => arg.getValue())
      .join(' ')
    templateBuilder.runCmd(command)
  }
}

function handleCopyInstruction(
  instruction: ModifiableInstruction,
  templateBuilder: DockerfileParserInterface
): void {
  const argumentsData = instruction.getArguments()
  if (argumentsData && argumentsData.length >= 2) {
    const src = argumentsData[0].getValue()
    const dest = argumentsData[argumentsData.length - 1].getValue()

    let user: string | undefined
    const flags = instruction.getFlags()
    const chownFlag = flags.find((flag) => flag.getName() === 'chown')
    if (chownFlag) {
      user = chownFlag.getValue() ?? undefined
    }

    templateBuilder.copy(src, dest, { user })
  }
}

function handleWorkdirInstruction(
  instruction: DockerfileInstruction,
  templateBuilder: DockerfileParserInterface
): void {
  const argumentsData = instruction.getArguments()
  if (argumentsData && argumentsData.length > 0) {
    const workdir = argumentsData[0].getValue()
    templateBuilder.setWorkdir(workdir)
  }
}

function handleUserInstruction(
  instruction: DockerfileInstruction,
  templateBuilder: DockerfileParserInterface
): void {
  const argumentsData = instruction.getArguments()
  if (argumentsData && argumentsData.length > 0) {
    const user = argumentsData[0].getValue()
    templateBuilder.setUser(user)
  }
}

/**
 * Strip surrounding double or single quotes from an ENV value.
 * Docker's ENV instruction strips quotes from values like ENV KEY="value".
 */
function stripQuotes(value: string): string {
  if (value.length >= 2) {
    if (
      (value[0] === '"' && value[value.length - 1] === '"') ||
      (value[0] === "'" && value[value.length - 1] === "'")
    ) {
      return value.slice(1, -1)
    }
  }
  return value
}

/**
 * Expand Docker-style variable references in a value string.
 * Supports ${VAR}, $VAR, ${VAR:-default}, and ${VAR:+replacement}.
 */
function expandEnvVars(
  value: string,
  envContext: Record<string, string>
): string {
  let result = value
  // Handle ${VAR:-default} — use default if VAR is unset or empty
  result = result.replace(
    /\$\{([a-zA-Z_][a-zA-Z0-9_]*):-([^}]*)\}/g,
    (_, name, defaultVal) => {
      const val = envContext[name]
      return val !== undefined && val !== '' ? val : defaultVal
    }
  )
  // Handle ${VAR:+replacement} — use replacement if VAR is set and non-empty
  result = result.replace(
    /\$\{([a-zA-Z_][a-zA-Z0-9_]*):\+([^}]*)\}/g,
    (_, name, replacement) => {
      const val = envContext[name]
      return val !== undefined && val !== '' ? replacement : ''
    }
  )
  // Handle ${VAR}
  result = result.replace(/\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (_, name) => {
    return envContext[name] !== undefined ? envContext[name] : ''
  })
  // Handle $VAR
  result = result.replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name) => {
    return envContext[name] !== undefined ? envContext[name] : ''
  })
  return result
}

/**
 * Process a raw ENV value by stripping quotes and expanding variable references.
 * Single-quoted values are not expanded (Docker semantics).
 */
function processEnvValue(
  value: string,
  envContext: Record<string, string>
): string {
  // Single-quoted values should not have variable expansion (Docker semantics)
  if (
    value.length >= 2 &&
    value[0] === "'" &&
    value[value.length - 1] === "'"
  ) {
    return value.slice(1, -1)
  }
  const unquoted = stripQuotes(value)
  return expandEnvVars(unquoted, envContext)
}

function handleEnvInstruction(
  instruction: DockerfileInstruction,
  templateBuilder: DockerfileParserInterface,
  envContext: Record<string, string>
): void {
  const argumentsData = instruction.getArguments()
  const keyword = instruction.getKeyword()

  if (argumentsData && argumentsData.length >= 1) {
    const envVars: Record<string, string> = {}
    // Snapshot the context before this instruction so all expansions in a
    // single ENV instruction resolve against the pre-instruction state
    // (Docker semantics: ENV A=new B=$A uses the value of A before this line).
    const preInstructionContext = { ...envContext }

    if (argumentsData.length === 2) {
      // ENV key value format OR multiple key=value pairs (from line continuation)
      const firstArg = argumentsData[0].getValue()
      const secondArg = argumentsData[1].getValue()

      // Check if both arguments contain '=' (multiple key=value pairs)
      if (firstArg.includes('=') && secondArg.includes('=')) {
        // Both are key=value pairs (line continuation)
        for (const arg of argumentsData) {
          const envString = arg.getValue()
          const equalIndex = envString.indexOf('=')
          if (equalIndex > 0) {
            const key = envString.substring(0, equalIndex)
            const rawValue = envString.substring(equalIndex + 1)
            envVars[key] = processEnvValue(rawValue, preInstructionContext)
          }
        }
      } else {
        // Traditional ENV key value format
        envVars[firstArg] = processEnvValue(secondArg, preInstructionContext)
      }
    } else if (argumentsData.length === 1) {
      // ENV/ARG key=value format (single argument) or ARG key (without default)
      const envString = argumentsData[0].getValue()

      // Check if it's a simple key=value or just a key (for ARG without default)
      const equalIndex = envString.indexOf('=')
      if (equalIndex > 0) {
        const key = envString.substring(0, equalIndex)
        const rawValue = envString.substring(equalIndex + 1)
        envVars[key] = processEnvValue(rawValue, preInstructionContext)
      } else if (keyword === 'ARG' && envString.trim()) {
        // ARG without default value - set as empty ENV
        envVars[envString.trim()] = ''
      }
    } else {
      // Multiple arguments (from line continuation with backslashes)
      for (const arg of argumentsData) {
        const envString = arg.getValue()
        const equalIndex = envString.indexOf('=')
        if (equalIndex > 0) {
          const key = envString.substring(0, equalIndex)
          const rawValue = envString.substring(equalIndex + 1)
          envVars[key] = processEnvValue(rawValue, preInstructionContext)
        } else if (keyword === 'ARG') {
          // ARG without default value
          envVars[envString] = ''
        }
      }
    }

    // Update the shared context after all pairs are resolved
    Object.assign(envContext, envVars)

    // Call setEnvs once with all environment variables from this instruction
    if (Object.keys(envVars).length > 0) {
      templateBuilder.setEnvs(envVars)
    }
  }
}

function handleCmdEntrypointInstruction(
  instruction: DockerfileInstruction,
  templateBuilder: DockerfileParserInterface
): void {
  const argumentsData = instruction.getArguments()
  if (argumentsData && argumentsData.length > 0) {
    let command = argumentsData.map((arg: Argument) => arg.getValue()).join(' ')

    try {
      const parsedCommand = JSON.parse(command)
      if (Array.isArray(parsedCommand)) {
        command = parsedCommand.join(' ')
      }
    } catch {
      // Do nothing
    }

    templateBuilder.setStartCmd(command, waitForTimeout(20_000))
  }
}
