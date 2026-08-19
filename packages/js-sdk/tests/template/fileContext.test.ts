import os from 'node:os'
import { describe, expect, test } from 'vitest'
import { Template } from '../../src'

// Path to a committed, read-only fixture, relative to this file's directory.
// The implicit file context is the directory of the file that calls Template(),
// so it is always inside the repository — which is why the fixture is committed
// and never written to, rather than generated into a temp directory.
const fixturePath = 'fixtures/hello.txt'

describe('file context', () => {
  test('defaults to the directory of the caller of Template()', async () => {
    const implicit = Template().fromBaseImage().copy(fixturePath, 'hello.txt')
    const explicit = Template({ fileContextPath: __dirname })
      .fromBaseImage()
      .copy(fixturePath, 'hello.txt')

    // toJSON hashes each COPY's files, so the two serializations only match if
    // the implicit context resolved to this file's directory, the glob found
    // the fixture there, and its contents were read. This is the only test that
    // exercises the implicit default end to end — every other template test
    // passes fileContextPath explicitly, and the unit test for
    // getCallerDirectory covers the helper in isolation, not its use here.
    expect(await Template.toJSON(implicit)).toBe(
      await Template.toJSON(explicit)
    )
  })

  test('fails to resolve a source that is not in the context', async () => {
    // Keeps the assertion above from passing vacuously: the hashes match
    // because the fixture was found, not because a missing file hashes the
    // same either way.
    const wrongContext = Template({ fileContextPath: os.tmpdir() })
      .fromBaseImage()
      .copy(fixturePath, 'hello.txt')

    await expect(Template.toJSON(wrongContext)).rejects.toThrow(
      /No files found/
    )
  })
})
