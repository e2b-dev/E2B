import fs from 'node:fs'
import { shellQuote } from '../utils'
import { CopyItem } from './types'
import { ReadyCmd, waitForTimeout } from './readycmd'
import {
  DockerfileHeredoc,
  DockerfileInstruction,
  DockerfileSyntaxError,
  ShellLex,
  chompHeredocContent,
  parseDockerfileAst,
  parseHeredoc,
} from '@e2b/dockerfile-utils'

export { DockerfileSyntaxError }

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

type FlagType = 'bool' | 'string'

interface FlagSpec {
  type: FlagType
  /** The flag is accepted but has no effect; a warning is emitted. */
  ignored?: boolean
}

const RUN_FLAGS: Record<string, FlagSpec> = {
  mount: { type: 'string', ignored: true },
  network: { type: 'string', ignored: true },
  security: { type: 'string', ignored: true },
  device: { type: 'string', ignored: true },
}

const COPY_FLAGS: Record<string, FlagSpec> = {
  chown: { type: 'string' },
  chmod: { type: 'string' },
  from: { type: 'string' },
  link: { type: 'bool', ignored: true },
  exclude: { type: 'string', ignored: true },
  parents: { type: 'bool', ignored: true },
}

const ADD_FLAGS: Record<string, FlagSpec> = {
  ...COPY_FLAGS,
  'keep-git-dir': { type: 'bool', ignored: true },
  checksum: { type: 'string', ignored: true },
  unpack: { type: 'bool', ignored: true },
}

const FROM_FLAGS: Record<string, FlagSpec> = {
  platform: { type: 'string', ignored: true },
}

// Metadata-only instructions that have no equivalent in a template.
const IGNORED_INSTRUCTIONS = new Set([
  'EXPOSE',
  'VOLUME',
  'LABEL',
  'MAINTAINER',
])

/** A heredoc delimiter that does not occur in the content it wraps. */
function heredocTerminator(name: string, content: string): string {
  const base = `E2B_HEREDOC_${name.replace(/[^A-Za-z0-9_]/g, '_')}`
  let underscores = 0
  for (let i = content.indexOf(base); i !== -1; i = content.indexOf(base, i)) {
    const start = i + base.length
    i = start
    while (content[i] === '_') {
      i++
    }
    underscores = Math.max(underscores, i - start + 1)
  }
  return base + '_'.repeat(underscores)
}

function withTrailingNewline(content: string): string {
  return content === '' || content.endsWith('\n') ? content : content + '\n'
}

const VARIABLE_NAME = /\p{Nd}+|[@*#?\-$!0]|[\p{L}\p{Nd}_]+/uy

function shellLiteral(ch: string, stopChar?: string): string {
  return ch === '\\' || ch === '`' || ch === '$' || ch === stopChar
    ? '\\' + ch
    : ch
}

/**
 * Rewrite an expandable heredoc body so that the shell applies Docker's
 * rules: `$VAR` / `${VAR...}` are substituted, a backslash escapes the next
 * character, and everything else - `$(...)` and backticks included - is
 * literal. Backslashes inside `#`, `%` and `/` patterns stay significant to
 * the shell's pattern matching, as they do for Docker.
 */
function expandableHeredocBody(content: string, line: number): string {
  let i = 0

  function missing(stopChar: string): never {
    const what = stopChar === '/' ? "'/' in ${}" : "'}'"
    throw new DockerfileSyntaxError(`syntax error: missing ${what}`, line)
  }

  function name(): string {
    VARIABLE_NAME.lastIndex = i
    const match = VARIABLE_NAME.exec(content)
    if (!match) {
      return ''
    }
    i += match[0].length
    return match[0]
  }

  function variable(): string {
    if (content[i] !== '{') {
      const varName = name()
      return varName === '' ? '\\$' : '$' + varName
    }
    i++
    if (i >= content.length) {
      missing('}')
    }
    if (content[i] === '{' || content[i] === '}' || content[i] === ':') {
      throw new DockerfileSyntaxError('syntax error: bad substitution', line)
    }
    const varName = name()
    if (i >= content.length) {
      missing('}')
    }
    let modifier = content[i++]
    if (modifier === '}') {
      return `\${${varName}}`
    }
    if (modifier === '/') {
      if (content[i] === '/') {
        modifier += content[i++]
      }
      const pattern = scan('/', true)
      return `\${${varName}${modifier}${pattern}/${scan('}', true)}}`
    }
    if (modifier === ':') {
      if (i >= content.length) {
        missing('}')
      }
      modifier += content[i++]
    }
    const op = modifier[modifier.length - 1]
    const isPattern = op === '#' || op === '%'
    if (!'+-?#%'.includes(op) || (modifier.length === 2 && isPattern)) {
      throw new DockerfileSyntaxError(
        `unsupported modifier (${modifier}) in substitution`,
        line
      )
    }
    return `\${${varName}${modifier}${scan('}', isPattern)}}`
  }

  function scan(stopChar?: string, rawEscapes = false): string {
    let out = ''
    while (i < content.length) {
      const ch = content[i++]
      if (ch === stopChar) {
        return out
      }
      if (ch === '\\') {
        if (i < content.length) {
          const next = content[i++]
          out += rawEscapes ? '\\' + next : shellLiteral(next, stopChar)
        }
      } else if (ch === '$') {
        out += variable()
      } else {
        out += ch === '`' ? '\\`' : ch
      }
    }
    if (stopChar !== undefined) {
      missing(stopChar)
    }
    return out
  }

  return scan()
}

function shellJoin(words: string[]): string {
  return words.map(shellQuote).join(' ')
}

interface StartCommand {
  json: boolean
  args: string[]
}

class DockerfileConverter {
  private readonly lex: ShellLex
  private readonly vars = new Map<string, string>()
  private userChanged = false
  private workdirChanged = false
  private cmd?: StartCommand
  private entrypoint?: StartCommand

  constructor(
    private readonly templateBuilder: DockerfileParserInterface,
    escapeToken: string
  ) {
    this.lex = new ShellLex(escapeToken)
  }

  convert(instructions: DockerfileInstruction[]): DockerfileParseResult {
    const fromInstructions = instructions.filter((i) => i.name === 'FROM')
    if (fromInstructions.length > 1) {
      throw new DockerfileSyntaxError(
        'Multi-stage Dockerfiles are not supported'
      )
    }
    if (fromInstructions.length === 0) {
      throw new DockerfileSyntaxError(
        'Dockerfile must contain a FROM instruction'
      )
    }

    const fromInstruction = fromInstructions[0]
    const baseImage = this.handleFrom(fromInstruction)

    // Set the user and workdir to the Docker defaults
    this.templateBuilder.setUser('root')
    this.templateBuilder.setWorkdir('/')

    for (const instruction of instructions) {
      if (instruction.name === 'FROM') {
        continue
      }
      if (
        instruction.startLine < fromInstruction.startLine &&
        instruction.name !== 'ARG'
      ) {
        throw new DockerfileSyntaxError(
          `${instruction.name} must be preceded by a FROM instruction`,
          instruction.startLine
        )
      }
      this.handleInstruction(instruction)
    }

    this.applyStartCmd()

    // Set the user and workdir to the E2B defaults
    if (!this.userChanged) {
      this.templateBuilder.setUser('user')
    }
    if (!this.workdirChanged) {
      this.templateBuilder.setWorkdir('/home/user')
    }

    return { baseImage }
  }

  private handleInstruction(instruction: DockerfileInstruction) {
    switch (instruction.name) {
      case 'RUN':
        this.handleRun(instruction)
        break
      case 'COPY':
        this.handleCopy(instruction, COPY_FLAGS)
        break
      case 'ADD':
        this.handleCopy(instruction, ADD_FLAGS)
        break
      case 'WORKDIR':
        this.templateBuilder.setWorkdir(this.expandSingle(instruction))
        this.workdirChanged = true
        break
      case 'USER':
        this.templateBuilder.setUser(this.expandSingle(instruction))
        this.userChanged = true
        break
      case 'ENV':
        this.handleEnv(instruction)
        break
      case 'ARG':
        this.handleArg(instruction)
        break
      case 'CMD':
        this.parseFlags(instruction, {})
        this.cmd = { json: instruction.json, args: instruction.args }
        break
      case 'ENTRYPOINT':
        this.parseFlags(instruction, {})
        this.entrypoint = { json: instruction.json, args: instruction.args }
        break
      default:
        if (!IGNORED_INSTRUCTIONS.has(instruction.name)) {
          console.warn(`Unsupported instruction: ${instruction.name}`)
        }
        break
    }
  }

  /** Resolve quotes and escapes in a word, keeping `$VAR` references. */
  private expand(instruction: DockerfileInstruction, word: string): string {
    try {
      return this.lex.processWord(word)
    } catch (err) {
      throw new DockerfileSyntaxError(
        err instanceof Error ? err.message : String(err),
        instruction.startLine
      )
    }
  }

  /**
   * Expand `$VAR` references against the `ARG` / `ENV` values declared earlier
   * in the Dockerfile, with BuildKit's `-`, `+` and `?` modifier semantics.
   * Only used where the converter itself needs the concrete value.
   */
  private resolveVars(word: string, line: number): string {
    let i = 0
    const readName = () => {
      const start = i
      while (i < word.length && /[A-Za-z0-9_]/.test(word[i])) {
        i++
      }
      return word.slice(start, i)
    }
    const scan = (stop?: string): string => {
      let out = ''
      while (i < word.length) {
        const ch = word[i]
        if (ch === stop) {
          return out
        }
        if (ch !== '$') {
          out += ch
          i++
          continue
        }
        i++
        if (word[i] !== '{') {
          const name = readName()
          out += name === '' ? '$' : (this.vars.get(name) ?? '')
          continue
        }
        i++
        const name = readName()
        const value = this.vars.get(name)
        if (word[i] === '}') {
          i++
          out += value ?? ''
          continue
        }
        let modifier = word[i++] ?? ''
        const nullIsUnset = modifier === ':'
        if (nullIsUnset) {
          modifier += word[i++] ?? ''
        }
        if (i > word.length) {
          throw new DockerfileSyntaxError("syntax error: missing '}'", line)
        }
        if (!'-+?'.includes(modifier[modifier.length - 1])) {
          throw new DockerfileSyntaxError(
            `unsupported modifier (${modifier}) in substitution when resolving ${JSON.stringify(word)}`,
            line
          )
        }
        const fallback = scan('}')
        i++
        const unset = value === undefined || (nullIsUnset && value === '')
        switch (modifier[modifier.length - 1]) {
          case '-':
            out += unset ? fallback : value
            break
          case '+':
            out += unset ? '' : fallback
            break
          default:
            if (unset) {
              throw new DockerfileSyntaxError(`${name}: ${fallback}`, line)
            }
            out += value
        }
      }
      if (stop !== undefined) {
        throw new DockerfileSyntaxError("syntax error: missing '}'", line)
      }
      return out
    }
    return scan()
  }

  private recordVar(key: string, value: string, line: number) {
    try {
      this.vars.set(key, this.resolveVars(value, line))
    } catch (err) {
      if (!(err instanceof DockerfileSyntaxError)) {
        throw err
      }
      this.vars.set(key, value)
    }
  }

  private expandSingle(instruction: DockerfileInstruction): string {
    this.parseFlags(instruction, {})
    if (instruction.args.length !== 1) {
      throw new DockerfileSyntaxError(
        `${instruction.name} requires exactly one argument`,
        instruction.startLine
      )
    }
    return this.expand(instruction, instruction.args[0])
  }

  private parseFlags(
    instruction: DockerfileInstruction,
    specs: Record<string, FlagSpec>
  ): Record<string, string> {
    const values: Record<string, string> = {}
    for (const flag of instruction.flags) {
      if (!flag.startsWith('--')) {
        throw new DockerfileSyntaxError(
          `arg should start with -- : ${flag}`,
          instruction.startLine
        )
      }
      const body = flag.slice(2)
      const eq = body.indexOf('=')
      const name = eq === -1 ? body : body.slice(0, eq)
      const rawValue = eq === -1 ? undefined : body.slice(eq + 1)

      const spec = Object.hasOwn(specs, name) ? specs[name] : undefined
      if (!spec) {
        throw new DockerfileSyntaxError(
          `unknown flag: ${name}`,
          instruction.startLine
        )
      }
      if (name in values) {
        throw new DockerfileSyntaxError(
          `duplicate flag specified: ${name}`,
          instruction.startLine
        )
      }

      let value: string
      if (spec.type === 'bool') {
        if (rawValue === undefined || rawValue === '' || rawValue === 'true') {
          value = 'true'
        } else if (rawValue === 'false') {
          value = 'false'
        } else {
          throw new DockerfileSyntaxError(
            `expecting boolean value for flag ${name}, not: ${rawValue}`,
            instruction.startLine
          )
        }
      } else {
        if (rawValue === undefined) {
          throw new DockerfileSyntaxError(
            `missing a value on flag: ${name}`,
            instruction.startLine
          )
        }
        value = rawValue
      }

      if (spec.ignored) {
        console.warn(
          `Ignoring unsupported ${instruction.name} flag --${name} (line ${instruction.startLine})`
        )
        continue
      }
      values[name] = value
    }
    return values
  }

  private handleFrom(instruction: DockerfileInstruction): string {
    this.parseFlags(instruction, FROM_FLAGS)
    const args = instruction.args
    if (args.length === 3 && args[1].toLowerCase() === 'as') {
      // stage alias is irrelevant for a single-stage build
    } else if (args.length !== 1) {
      throw new DockerfileSyntaxError(
        'FROM requires either one or three arguments',
        instruction.startLine
      )
    }
    return this.expand(instruction, args[0])
  }

  private handleRun(instruction: DockerfileInstruction) {
    this.parseFlags(instruction, RUN_FLAGS)
    const { args, json, heredocs } = instruction
    if (args.length === 0) {
      throw new DockerfileSyntaxError(
        'RUN requires at least one argument',
        instruction.startLine
      )
    }

    let command: string
    if (json) {
      command = shellJoin(args)
    } else if (heredocs.length > 0) {
      command = this.runWithHeredocs(args[0], heredocs)
    } else {
      command = args[0]
    }
    this.templateBuilder.runCmd(command)
  }

  private runWithHeredocs(line: string, heredocs: DockerfileHeredoc[]): string {
    const heredocContent = (heredoc: DockerfileHeredoc) =>
      heredoc.chomp ? chompHeredocContent(heredoc.content) : heredoc.content

    // `RUN <<EOF` on its own: the heredoc body is the script itself.
    if (heredocs.length === 1 && parseHeredoc(line.trim())) {
      const heredoc = heredocs[0]
      const content = heredocContent(heredoc)
      if (!content.startsWith('#!')) {
        return content
      }
      // A shebang script: write it to a temporary file and execute it.
      const script = shellQuote(`/tmp/${heredoc.name}`)
      const terminator = heredocTerminator(heredoc.name, content)
      return (
        `cat <<'${terminator}' >${script}\n` +
        withTrailingNewline(content) +
        `${terminator}\n` +
        `chmod +x ${script} && ${script}\n` +
        `E2B_EXIT=$?; rm -f ${script}; exit $E2B_EXIT`
      )
    }

    // Heredocs used as part of a larger command (`cat <<EOF > file`,
    // `python3 <<EOF`): rebuild the heredoc so the shell handles it.
    let full = line
    for (const heredoc of heredocs) {
      full += '\n' + heredoc.content + heredoc.name
    }
    return full
  }

  private handleCopy(
    instruction: DockerfileInstruction,
    specs: Record<string, FlagSpec>
  ) {
    const flags = this.parseFlags(instruction, specs)
    if (instruction.args.length < 2) {
      throw new DockerfileSyntaxError(
        `${instruction.name} requires at least two arguments`,
        instruction.startLine
      )
    }
    if (flags.from !== undefined) {
      throw new DockerfileSyntaxError(
        `${instruction.name} --from is not supported (multi-stage builds are not supported)`,
        instruction.startLine
      )
    }

    const user =
      flags.chown !== undefined
        ? this.expand(instruction, flags.chown)
        : undefined
    let mode: number | undefined
    if (flags.chmod !== undefined) {
      const chmod = this.expand(instruction, flags.chmod)
      const resolved = this.resolveVars(chmod, instruction.startLine)
      if (!/^[0-7]{3,4}$/.test(resolved)) {
        const detail =
          resolved === chmod
            ? ''
            : ` (resolves to "${resolved}"; only values set by an earlier ARG or ENV instruction are known)`
        throw new DockerfileSyntaxError(
          `invalid chmod value "${chmod}"${detail}, expected an octal mode such as 0755`,
          instruction.startLine
        )
      }
      mode = parseInt(resolved, 8)
    }

    // Heredoc markers are recognized on the raw tokens, like the AST does:
    // a quoted `"<<EOF"` is a literal file name, not a heredoc.
    const rawDest = instruction.args[instruction.args.length - 1]
    if (parseHeredoc(rawDest)) {
      throw new DockerfileSyntaxError(
        `${instruction.name} cannot accept a heredoc as a destination`,
        instruction.startLine
      )
    }
    const dest = this.expand(instruction, rawDest)

    const heredocsByName = new Map(
      instruction.heredocs.map((heredoc) => [heredoc.name, heredoc])
    )

    for (const rawSrc of instruction.args.slice(0, -1)) {
      const heredoc = parseHeredoc(rawSrc)
      if (heredoc) {
        const content = heredocsByName.get(heredoc.name)
        if (!content) {
          throw new DockerfileSyntaxError(
            `missing heredoc content for ${heredoc.name}`,
            instruction.startLine
          )
        }
        this.copyHeredoc(content, dest, user, mode, instruction.startLine)
        continue
      }
      const src = this.expand(instruction, rawSrc)
      if (instruction.name === 'ADD' && /^[a-z][a-z0-9+.-]*:\/\//i.test(src)) {
        throw new DockerfileSyntaxError(
          `ADD from a remote URL is not supported: ${src}`,
          instruction.startLine
        )
      }
      this.templateBuilder.copy(src, dest, { user, mode })
    }
  }

  /** `COPY <<EOF /path` writes the heredoc body to a file inside the sandbox. */
  private copyHeredoc(
    heredoc: DockerfileHeredoc,
    dest: string,
    user: string | undefined,
    mode: number | undefined,
    line: number
  ) {
    let content = heredoc.chomp
      ? chompHeredocContent(heredoc.content)
      : heredoc.content
    if (heredoc.expand) {
      try {
        content = expandableHeredocBody(content, line)
      } catch (err) {
        if (err instanceof DockerfileSyntaxError) {
          throw err
        }
        throw new DockerfileSyntaxError(
          err instanceof Error ? err.message : String(err),
          line
        )
      }
    }
    const plainTerminator = heredocTerminator(heredoc.name, content)
    const terminator = heredoc.expand ? plainTerminator : `'${plainTerminator}'`
    const target = '"$E2B_HEREDOC_DEST"'

    // Like Docker, a dest that is a directory receives a file named after the heredoc.
    let command = dest.endsWith('/')
      ? `E2B_HEREDOC_DEST=${shellQuote(dest + heredoc.name)}\n`
      : `E2B_HEREDOC_DEST=${shellQuote(dest)}\n` +
        `if [ -d ${target} ]; then E2B_HEREDOC_DEST=${target}/${shellQuote(heredoc.name)}; fi\n`
    command +=
      `mkdir -p "$(dirname ${target})" && cat <<${terminator} >${target}\n` +
      withTrailingNewline(content) +
      plainTerminator
    if (user !== undefined) {
      command += `\nchown ${shellQuote(user)} ${target}`
    }
    if (mode !== undefined) {
      command += `\nchmod ${mode.toString(8)} ${target}`
    }
    // COPY writes as the builder (root), independent of the current USER.
    this.templateBuilder.runCmd(command, { user: 'root' })
  }

  private handleEnv(instruction: DockerfileInstruction) {
    this.parseFlags(instruction, {})
    const { args } = instruction
    if (args.length === 0) {
      throw new DockerfileSyntaxError(
        'ENV requires at least one argument',
        instruction.startLine
      )
    }
    const envs: Record<string, string> = {}
    for (let i = 0; i + 2 < args.length; i += 3) {
      const key = this.expand(instruction, args[i])
      if (key === '') {
        throw new DockerfileSyntaxError(
          'ENV names can not be blank',
          instruction.startLine
        )
      }
      envs[key] = this.expand(instruction, args[i + 1])
      this.recordVar(key, envs[key], instruction.startLine)
    }
    this.templateBuilder.setEnvs(envs)
  }

  private handleArg(instruction: DockerfileInstruction) {
    this.parseFlags(instruction, {})
    const { args } = instruction
    if (args.length === 0) {
      throw new DockerfileSyntaxError(
        'ARG requires at least one argument',
        instruction.startLine
      )
    }
    const envs: Record<string, string> = {}
    for (const arg of args) {
      const eq = arg.indexOf('=')
      const key = this.expand(instruction, eq === -1 ? arg : arg.slice(0, eq))
      if (key === '') {
        throw new DockerfileSyntaxError(
          'ARG names can not be blank',
          instruction.startLine
        )
      }
      envs[key] = eq === -1 ? '' : this.expand(instruction, arg.slice(eq + 1))
      this.recordVar(key, envs[key], instruction.startLine)
    }
    this.templateBuilder.setEnvs(envs)
  }

  /**
   * Combine ENTRYPOINT and CMD following Docker's rules:
   * - exec-form ENTRYPOINT gets CMD appended as arguments
   *   (a shell-form CMD is appended as `/bin/sh -c <cmd>`),
   * - shell-form ENTRYPOINT ignores CMD,
   * - without ENTRYPOINT the CMD is used as-is.
   */
  private applyStartCmd() {
    const { cmd, entrypoint } = this
    let command: string | undefined

    if (entrypoint) {
      if (entrypoint.json) {
        const words = [...entrypoint.args]
        if (cmd) {
          if (cmd.json) {
            words.push(...cmd.args)
          } else if (cmd.args.length > 0) {
            words.push('/bin/sh', '-c', cmd.args[0])
          }
        }
        command = words.length > 0 ? shellJoin(words) : undefined
      } else {
        command = entrypoint.args.length > 0 ? entrypoint.args[0] : undefined
      }
    } else if (cmd) {
      if (cmd.json) {
        command = cmd.args.length > 0 ? shellJoin(cmd.args) : undefined
      } else {
        command = cmd.args.length > 0 ? cmd.args[0] : undefined
      }
    }

    if (command !== undefined && command.trim() !== '') {
      this.templateBuilder.setStartCmd(command, waitForTimeout(20_000))
    }
  }
}

function readDockerfile(dockerfileContentOrPath: string): string {
  try {
    if (
      fs.existsSync(dockerfileContentOrPath) &&
      fs.statSync(dockerfileContentOrPath).isFile()
    ) {
      return fs.readFileSync(dockerfileContentOrPath, 'utf-8')
    }
  } catch {
    // If there's any error checking the file, treat as content
  }
  return dockerfileContentOrPath
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
  const dockerfileContent = readDockerfile(dockerfileContentOrPath)

  const ast = parseDockerfileAst(dockerfileContent)

  for (const warning of ast.warnings) {
    console.warn(`${warning.message} (line ${warning.line})`)
  }

  return new DockerfileConverter(templateBuilder, ast.escapeToken).convert(
    ast.instructions
  )
}
