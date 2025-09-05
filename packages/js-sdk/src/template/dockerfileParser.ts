import { Instructions } from './types'
import { DockerfileParser, Instruction, Argument } from 'dockerfile-ast'
import fs from 'node:fs'

export interface DockerfileParseResult {
  baseImage: string
  instructions: Instructions[]
}

export interface DockerfileParserInterface {
  setWorkdir(workdir: string): void
  setUser(user: string): void
  setEnvs(envs: Record<string, string>): void
  runCmd(command: string): void
  copy(src: string, dest: string): void
  setStartCmd(startCommand: string, readyCommand: string): void
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
  if (argumentsData && argumentsData.length > 0) {
    baseImage = argumentsData[0].getValue()
  }

  const resultInstructions: Instructions[] = []

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
        handleCopyInstruction(instruction, templateBuilder)
        break

      case 'WORKDIR':
        handleWorkdirInstruction(instruction, templateBuilder)
        break

      case 'USER':
        handleUserInstruction(instruction, templateBuilder)
        break

      case 'ENV':
      case 'ARG':
        handleEnvInstruction(instruction, templateBuilder)
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

  return {
    baseImage,
    instructions: resultInstructions,
  }
}

function handleRunInstruction(
  instruction: Instruction,
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
  instruction: Instruction,
  templateBuilder: DockerfileParserInterface
): void {
  const argumentsData = instruction.getArguments()
  if (argumentsData && argumentsData.length >= 2) {
    const src = argumentsData[0].getValue()
    const dest = argumentsData[argumentsData.length - 1].getValue()
    templateBuilder.copy(src, dest)
  }
}

function handleWorkdirInstruction(
  instruction: Instruction,
  templateBuilder: DockerfileParserInterface
): void {
  const argumentsData = instruction.getArguments()
  if (argumentsData && argumentsData.length > 0) {
    const workdir = argumentsData[0].getValue()
    templateBuilder.setWorkdir(workdir)
  }
}

function handleUserInstruction(
  instruction: Instruction,
  templateBuilder: DockerfileParserInterface
): void {
  const argumentsData = instruction.getArguments()
  if (argumentsData && argumentsData.length > 0) {
    const user = argumentsData[0].getValue()
    templateBuilder.setUser(user)
  }
}

function handleEnvInstruction(
  instruction: Instruction,
  templateBuilder: DockerfileParserInterface
): void {
  const argumentsData = instruction.getArguments()
  const keyword = instruction.getKeyword()

  if (argumentsData && argumentsData.length >= 1) {
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
            const value = envString.substring(equalIndex + 1)
            templateBuilder.setEnvs({ [key]: value })
          }
        }
      } else {
        // Traditional ENV key value format
        templateBuilder.setEnvs({ [firstArg]: secondArg })
      }
    } else if (argumentsData.length === 1) {
      // ENV/ARG key=value format (single argument) or ARG key (without default)
      const envString = argumentsData[0].getValue()

      // Check if it's a simple key=value or just a key (for ARG without default)
      const equalIndex = envString.indexOf('=')
      if (equalIndex > 0) {
        const key = envString.substring(0, equalIndex)
        const value = envString.substring(equalIndex + 1)
        templateBuilder.setEnvs({ [key]: value })
      } else if (keyword === 'ARG' && envString.trim()) {
        // ARG without default value - set as empty ENV
        const key = envString.trim()
        templateBuilder.setEnvs({ [key]: '' })
      }
    } else {
      // Multiple arguments (from line continuation with backslashes)
      for (const arg of argumentsData) {
        const envString = arg.getValue()
        const equalIndex = envString.indexOf('=')
        if (equalIndex > 0) {
          const key = envString.substring(0, equalIndex)
          const value = envString.substring(equalIndex + 1)
          templateBuilder.setEnvs({ [key]: value })
        } else if (keyword === 'ARG') {
          // ARG without default value
          const key = envString
          templateBuilder.setEnvs({ [key]: '' })
        }
      }
    }
  }
}

function handleCmdEntrypointInstruction(
  instruction: Instruction,
  templateBuilder: DockerfileParserInterface
): void {
  const argumentsData = instruction.getArguments()
  if (argumentsData && argumentsData.length > 0) {
    const command = argumentsData
      .map((arg: Argument) => arg.getValue())
      .join(' ')
    // Import waitForTimeout locally to avoid circular dependency
    const waitForTimeout = (timeout: number) => `sleep ${timeout / 1000}`
    templateBuilder.setStartCmd(command, waitForTimeout(20_000))
  }
}
