import { execSync } from 'child_process'
import * as ts from 'typescript'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

function typeScriptSyntaxErrors(source: string): string[] {
  const { diagnostics } = ts.transpileModule(source, {
    reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  })

  const errors: string[] = []
  for (const diagnostic of diagnostics ?? []) {
    if (diagnostic.category === ts.DiagnosticCategory.Error) {
      errors.push(
        ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
      )
    }
  }
  return errors
}

describe('Template Migration Escaping', () => {
  let testDir: string
  const cliPath = path.join(process.cwd(), 'dist', 'index.js')
  const fixtureDir = path.join(__dirname, 'fixtures', 'quoted-commands')

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'e2b-generate-test-'))
  })

  afterEach(async () => {
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true })
    }
  })

  async function migrate(language: string): Promise<void> {
    await fs.copyFile(
      path.join(fixtureDir, 'e2b.Dockerfile'),
      path.join(testDir, 'e2b.Dockerfile')
    )

    execSync(
      `node "${cliPath}" template migrate --language ${language} --name quoted-commands`,
      { cwd: testDir, stdio: 'pipe' }
    )
  }

  test('escapes quoted RUN and ENV values in generated TypeScript', async () => {
    await migrate('typescript')

    const raw = await fs.readFile(path.join(testDir, 'template.ts'), 'utf-8')
    // A CRLF checkout keeps the carriage returns in heredoc content, which the
    // generator then escapes; normalize the escape sequences so the assertion
    // is checkout-independent.
    const content = raw.replace(/\\r\\n/g, '\\n')

    // Every string literal stays inside its single quotes, whatever the
    // Dockerfile command contained.
    expect(content).toContain(`.runCmd('echo "double" && echo \\'single\\'')`)
    expect(content).toContain(`'GREETING': 'say "hi"',`)
    expect(content).toContain(`'NOTE': 'it\\'s fine',`)
    // Heredoc RUN commands carry literal newlines, which must not terminate
    // the string literal.
    expect(content).toContain(`.runCmd('echo "heredoc line"\\necho done\\n')`)

    expect(typeScriptSyntaxErrors(content)).toEqual([])
  })

  test('escapes quoted RUN and ENV values in generated Python', async () => {
    await migrate('python-sync')

    const raw = await fs.readFile(path.join(testDir, 'template.py'), 'utf-8')
    const content = raw.replace(/\\r\\n/g, '\\n')

    expect(content).toContain(`.run_cmd("echo \\"double\\" && echo 'single'")`)
    expect(content).toContain(`"GREETING": "say \\"hi\\"",`)
    expect(content).toContain(`"NOTE": "it's fine",`)
    expect(content).toContain(
      `.run_cmd("echo \\"heredoc line\\"\\necho done\\n")`
    )
  })
})
