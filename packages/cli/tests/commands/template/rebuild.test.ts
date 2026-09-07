import * as path from 'path'
import { execSync } from 'child_process'
import { describe, expect, test } from 'vitest'

// Black-box CLI tests (same idiom as publish.test.ts): run the built binary and
// assert on output up to the network boundary. The --refresh-envd guard and the
// command registration are deterministic and need no API key or network.
describe('template rebuild', () => {
  const cliPath = path.join(process.cwd(), 'dist', 'index.js')

  function run(args: string): string {
    try {
      return execSync(`node "${cliPath}" ${args} 2>&1`, {
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 10_000,
      })
    } catch (err: any) {
      return (err?.stdout ?? '') + (err?.stderr ?? '')
    }
  }

  test('without --refresh-envd it refuses and points at the flag', () => {
    const output = run('template rebuild some-template')
    expect(output).toContain('--refresh-envd')
    expect(output).not.toContain('Refreshing envd')
  })

  test('is registered and documented under template help', () => {
    const output = run('template rebuild --help')
    expect(output).toContain('rebuild')
    expect(output).toContain('--refresh-envd')
    // The description explains the old-envd motivation.
    expect(output).toContain('envd')
  })
})
