import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

const script = join(__dirname, '../../../scripts/generate-retry-policy.mjs')

function generate(paths: Record<string, unknown>, ext: '.ts' | '.py') {
  const dir = mkdtempSync(join(tmpdir(), 'retry-policy-'))
  const specPath = join(dir, 'spec.json')
  const outPath = join(dir, `out${ext}`)
  writeFileSync(specPath, JSON.stringify({ openapi: '3.0.0', paths }))
  execFileSync(process.execPath, [script, specPath, outPath])
  return readFileSync(outPath, 'utf8')
}

describe('generate-retry-policy', () => {
  test('emits x-idempotent: false operations and POSTs without x-idempotent: true', () => {
    const out = generate(
      {
        '/sandboxes': { post: { 'x-idempotent': false }, get: {} },
        '/sandboxes/{sandboxID}/pause': { post: { 'x-idempotent': true } },
        '/sandboxes/{sandboxID}/refreshes': { post: {} },
        '/sandboxes/{sandboxID}': { delete: {}, put: {} },
        '/legacy': { put: { 'x-idempotent': false } },
      },
      '.ts'
    )
    expect(out).toContain(`['POST', '/sandboxes'],`)
    expect(out).toContain(`['POST', '/sandboxes/{sandboxID}/refreshes'],`)
    expect(out).toContain(`['PUT', '/legacy'],`)
    expect(out).not.toContain('pause')
    expect(out).not.toContain(`'GET'`)
    expect(out).not.toContain(`'DELETE'`)
    expect(out).not.toContain(`['PUT', '/sandboxes/{sandboxID}']`)
  })

  test('emits Python for a .py output', () => {
    const out = generate(
      { '/volumes': { post: { 'x-idempotent': false } } },
      '.py'
    )
    expect(out).toContain(
      'NON_IDEMPOTENT_OPERATIONS: List[Tuple[str, str]] = ['
    )
    expect(out).toContain('("POST", "/volumes"),')
  })

  test('fails when the spec has no x-idempotent annotation at all', () => {
    expect(() => generate({ '/sandboxes': { post: {} } }, '.ts')).toThrow(
      /no operation declares x-idempotent/
    )
  })

  test('fails on a non-boolean x-idempotent', () => {
    expect(() =>
      generate({ '/sandboxes': { post: { 'x-idempotent': 'no' } } }, '.ts')
    ).toThrow(/must be a boolean/)
  })
})
