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
    const dest = argumentsData[argumentsData.length - 1].getValue()
    const sources = argumentsData
      .slice(0, -1)
      .map((arg: Argument) => arg.getValue())

    let user: string | undefined
    const flags = instruction.getFlags()
    const chownFlag = flags.find((flag) => flag.getName() === 'chown')
    if (chownFlag) {
      user = chownFlag.getValue() ?? undefined
    }

    for (const src of sources) {
      templateBuilder.copy(src, dest, { user })
    }
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

function handleEnvInstruction(
  instruction: DockerfileInstruction,
  templateBuilder: DockerfileParserInterface
): void {
  const argumentsData = instruction.getArguments()
  const keyword = instruction.getKeyword()

  if (!argumentsData || argumentsData.length === 0) {
    return
  }

  // dockerfile-ast splits arguments on whitespace, including inside quotes, so
  // rejoin them to recover the raw value and parse it like the Python SDK: in
  // the `key=value` form a value runs across whitespace until the next `key=`
  // token, and surrounding quotes are stripped. Parsing each token in isolation
  // mangled `ENV NAME="John Doe"` and `ENV KEY=a b` into a broken key.
  const value = argumentsData.map((arg) => arg.getValue()).join(' ')
  const envVars: Record<string, string> = {}

  if (value.includes('=')) {
    const pairRegex = /(\w+)=([^\s]*(?:\s+(?!\w+=)[^\s]*)*)/g
    let match: RegExpExecArray | null
    while ((match = pairRegex.exec(value)) !== null) {
      envVars[match[1]] = match[2].replace(/^["']+|["']+$/g, '')
    }
  } else {
    const spaceForm = value.match(/^(\S+)\s+([\s\S]+)$/)
    if (spaceForm) {
      envVars[spaceForm[1]] = spaceForm[2].replace(/^["']+|["']+$/g, '')
    } else if (keyword === 'ARG' && value.trim()) {
      envVars[value.trim()] = ''
    }
  }

  if (Object.keys(envVars).length > 0) {
    templateBuilder.setEnvs(envVars)
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
