import { Argument, CommandUnknownOpts, Help } from '@commander-js/extra-typings'
import { stripVTControlCharacters } from 'node:util'

/**
 * Render the CLI reference as Markdown, one page per top-level command.
 *
 * Walks the command tree through commander's public Help API, so the reference
 * lists exactly what `--help` does: hidden commands and options (like the
 * deprecated `--team`) are left out, and defaults are formatted by commander.
 *
 * The pages are published as MDX by e2b-dev/docs, so free text is escaped:
 * `<placeholder>` tokens become inline code and other `<`, `>`, `{`, `}` become
 * HTML entities.
 *
 * @returns Map of file name (e.g. `sandbox.md`) to page contents.
 */
export function renderReference(
  program: CommandUnknownOpts
): Map<string, string> {
  const help = program.createHelp()
  const pages = new Map<string, string>()

  for (const command of subcommands(help, program)) {
    pages.set(
      `${command.name()}.md`,
      renderCommand(help, command, [program.name()]).join('\n')
    )
  }

  return pages
}

function renderCommand(
  help: Help,
  command: CommandUnknownOpts,
  parents: string[]
): string[] {
  const path = [...parents, command.name()]
  const lines = [`## ${path.join(' ')}`, '']

  const description = help.commandDescription(command)
  if (description) {
    lines.push(mdx(description), '')
  }

  lines.push(
    '### Usage',
    '',
    '```bash',
    `${path.join(' ')} ${command.usage()}`,
    '```',
    ''
  )

  const aliases = command.aliases()
  if (aliases.length > 0) {
    lines.push(
      `**${aliases.length > 1 ? 'Aliases' : 'Alias'}:** ${aliases
        .map((alias) => `\`${alias}\``)
        .join(', ')}`,
      ''
    )
  }

  const args = help.visibleArguments(command)
  if (args.length > 0) {
    lines.push('### Arguments', '')
    for (const arg of args) {
      lines.push(item(argumentTerm(arg), help.argumentDescription(arg)))
    }
    lines.push('')
  }

  // Skip the built-in `-h, --help`, which every command has.
  const options = help
    .visibleOptions(command)
    .filter((option) => command.options.includes(option))
  if (options.length > 0) {
    lines.push('### Options', '')
    for (const option of options) {
      lines.push(item(help.optionTerm(option), help.optionDescription(option)))
    }
    lines.push('')
  }

  for (const subcommand of subcommands(help, command)) {
    lines.push(...renderCommand(help, subcommand, path))
  }

  return lines
}

/** Visible subcommands, without the implicit `help` command. */
function subcommands(
  help: Help,
  command: CommandUnknownOpts
): CommandUnknownOpts[] {
  return help
    .visibleCommands(command)
    .filter((subcommand) => command.commands.includes(subcommand))
}

/** `<name>` for required arguments, `[name]` for optional ones, as in usage. */
function argumentTerm(arg: Argument): string {
  const name = `${arg.name()}${arg.variadic ? '...' : ''}`
  return arg.required ? `<${name}>` : `[${name}]`
}

function item(term: string, description: string): string {
  return description ? `- \`${term}\`: ${mdx(description)}` : `- \`${term}\``
}

function mdx(text: string): string {
  return stripVTControlCharacters(text)
    .split(/(`[^`]*`|<[^<>\s]+>)/)
    .map((part, i) => {
      if (i % 2 === 0) {
        return part.replace(/[<>{}]/g, (c) => `&#${c.charCodeAt(0)};`)
      }
      return part.startsWith('`') ? part : `\`${part}\``
    })
    .join('')
}
