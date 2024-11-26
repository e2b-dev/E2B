import { Command } from 'commander'
import fs from 'fs'
import json2md from 'json2md'
import path from 'path'

/**
 * Converts command objects to Markdown documentation.
 * This function takes an array of command objects and generates a structured
 * Markdown document describing each command, its usage, options, and subcommands.
 * @returns A string containing the entire markdown documentation for all commands.
 */
export function commands2md(commands: Command[]): void {
  const outputDir = 'sdk_ref'
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  function commandToMd(
    command: any,
    parentName: string = ''
  ): [string, string] {
    const commandName = command.name() as string
    const fullName = parentName ? `${parentName} ${commandName}` : commandName

    const mdStructure = [
      { h2: `e2b ${fullName}` },
      { p: command.description() },
      { h3: 'Usage' },
      {
        code: {
          language: 'bash',
          content: `e2b ${fullName} ${command.usage()}`,
        },
      },
      ...(command.options.length > 0
        ? [
            { h3: 'Options' },
            {
              ul: command.options.map(
                (y: any) =>
                  `\`${y.flags}: ${y.description} ${
                    y.defaultValue !== undefined
                      ? `[default: ${y.defaultValue}]`
                      : ''
                  }\``
              ),
            },
          ]
        : []),
    ]

    let mdContent = json2md(mdStructure)

    // Process subcommands
    command.commands.forEach((subcommand: any) => {
      const [, subMdContent] = commandToMd(subcommand, fullName)
      mdContent += subMdContent + '\n\n'
    })

    // Clean the mdContent from terminal colors and escape HTML characters
    mdContent = mdContent
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/\[1m/g, '')
      .replace(/\[22m/g, '')
      .replace(/\[34m/g, '')
      .replace(/\[39m/g, '')
      .replace(/\[38;2;255;183;102m/g, '')

    return [fullName, mdContent]
  }

  commands.forEach((command: any) => {
    try {
      const [commandName, mdContent] = commandToMd(command)
      const fileName = `${commandName}.md`
      const filePath = path.join(outputDir, fileName)
      fs.writeFileSync(filePath, mdContent)
      console.log(`Generated documentation for ${commandName} at ${filePath}`)
    } catch (error) {
      console.error(`Error processing command: ${command.name()}`)
      console.error(error)
    }
  })
}
