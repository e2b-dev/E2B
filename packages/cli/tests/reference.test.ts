import { Command, Option } from '@commander-js/extra-typings'
import { describe, expect, test } from 'vitest'

import { renderReference } from '../scripts/reference'

describe('renderReference', () => {
  function render(configure: (cmd: Command) => void): string {
    const root = new Command('e2b')
    configure(root.command('thing').description('manage things'))
    return renderReference(root).get('thing.md')!
  }

  test('renders one page per visible top-level command', () => {
    const root = new Command('e2b')
    root.command('a')
    root.command('b')
    root.command('secret', { hidden: true })

    expect([...renderReference(root).keys()]).toEqual(['a.md', 'b.md'])
  })

  test('renders usage, aliases, arguments and options', () => {
    const md = render((cmd) =>
      cmd
        .alias('th')
        .argument('<id>', 'thing ID')
        .argument('[rest...]', 'more things')
        .option('-f, --format <format>', 'output format', 'pretty')
    )

    expect(md).toBe(`## e2b thing

manage things

### Usage

\`\`\`bash
e2b thing [options] <id> [rest...]
\`\`\`

**Alias:** \`th\`

### Arguments

- \`<id>\`: thing ID
- \`[rest...]\`: more things

### Options

- \`-f, --format <format>\`: output format (default: "pretty")
`)
  })

  test('omits hidden options, the help option and the help command', () => {
    const md = render((cmd) => {
      cmd.addOption(new Option('--legacy', 'old flag').hideHelp())
      cmd.command('child')
    })

    expect(md).not.toContain('--legacy')
    expect(md).not.toContain('--help')
    expect(md).toContain('## e2b thing child')
    expect(md).not.toContain('## e2b thing help')
  })

  test('escapes free text for MDX', () => {
    const md = render((cmd) =>
      cmd.option('--id <id>', 'use \x1b[1m<id>\x1b[22m, not {} or a < b')
    )

    expect(md).toContain(
      '- `--id <id>`: use `<id>`, not &#123;&#125; or a &#60; b'
    )
  })
})
