import {
  expect,
  test,
  describe,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from 'vitest'
import { writeFile, mkdir, rm, symlink, readFile, access } from 'fs/promises'
import fs from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { tarFileToStream } from '../../../src/template/utils'
import * as tar from 'tar'
import { ReadEntry } from 'tar'

describe('tarFileToStream', () => {
  const testDir = join(__dirname, 'tar-test-folder')

  beforeAll(async () => {
    await rm(testDir, { recursive: true, force: true })
    await mkdir(testDir, { recursive: true })
  })

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  beforeEach(async () => {
    await rm(testDir, { recursive: true, force: true })
    await mkdir(testDir, { recursive: true })
  })

  /**
   * Wait until a path no longer exists. Cleanup runs asynchronously from the
   * stream's `close` handler, so it may not complete in the same tick.
   */
  async function waitUntilGone(target: string): Promise<void> {
    for (let i = 0; i < 100; i++) {
      try {
        await access(target)
      } catch {
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
    throw new Error(`path was not removed: ${target}`)
  }

  /**
   * Pipe an archive stream into tar's extractor and collect its entries.
   */
  async function extractTarStream(
    stream: Readable
  ): Promise<{ extractDir: string; members: ReadEntry[] }> {
    const extractDir = join(
      tmpdir(),
      `tar-extract-${Date.now()}-${Math.random()}`
    )
    await mkdir(extractDir, { recursive: true })

    const members: ReadEntry[] = []
    await pipeline(
      stream,
      tar.extract({
        cwd: extractDir,
        gzip: true,
        onentry: (entry: ReadEntry) => {
          members.push(entry)
        },
      })
    )

    return { extractDir, members }
  }

  /**
   * Extract archive contents into a map of path -> file contents.
   */
  async function extractTarContents(
    stream: Readable
  ): Promise<Map<string, Buffer | null>> {
    const { extractDir, members } = await extractTarStream(stream)
    const contents = new Map<string, Buffer | null>()

    for (const member of members) {
      if (member.type === 'File') {
        try {
          contents.set(
            member.path,
            await readFile(join(extractDir, member.path))
          )
        } catch {
          // File might not exist
        }
      } else if (member.type === 'Directory') {
        contents.set(member.path, null)
      } else if (member.type === 'SymbolicLink') {
        contents.set(member.path, Buffer.from(member.linkpath || ''))
      }
    }

    await rm(extractDir, { recursive: true, force: true })
    return contents
  }

  /**
   * Extract archive members into a map of path -> entry.
   */
  async function getTarMembers(
    stream: Readable
  ): Promise<Map<string, ReadEntry>> {
    const { extractDir, members } = await extractTarStream(stream)
    const map = new Map<string, ReadEntry>()
    for (const member of members) {
      map.set(member.path, member)
    }
    await rm(extractDir, { recursive: true, force: true })
    return map
  }

  test('should create tar with simple files', async () => {
    await writeFile(join(testDir, 'file1.txt'), 'content1')
    await writeFile(join(testDir, 'file2.txt'), 'content2')

    const { stream, size } = await tarFileToStream('*.txt', testDir, [], false)
    expect(size).toBeGreaterThan(0)

    const contents = await extractTarContents(stream)

    expect(contents.size).toBe(2)
    expect(contents.get('file1.txt')?.toString()).toBe('content1')
    expect(contents.get('file2.txt')?.toString()).toBe('content2')
  })

  test('should respect ignore patterns', async () => {
    await writeFile(join(testDir, 'file1.txt'), 'content1')
    await writeFile(join(testDir, 'file2.txt'), 'content2')
    await writeFile(join(testDir, 'temp.txt'), 'temp content')
    await writeFile(join(testDir, 'backup.txt'), 'backup content')

    const { stream } = await tarFileToStream(
      '*.txt',
      testDir,
      ['temp*', 'backup*'],
      false
    )

    const contents = await extractTarContents(stream)

    expect(contents.size).toBe(2)
    expect(contents.get('file1.txt')?.toString()).toBe('content1')
    expect(contents.get('file2.txt')?.toString()).toBe('content2')
    expect(contents.has('temp.txt')).toBe(false)
    expect(contents.has('backup.txt')).toBe(false)
  })

  test('should handle nested files', async () => {
    const nestedDir = join(testDir, 'src', 'components')
    await mkdir(nestedDir, { recursive: true })

    await writeFile(join(testDir, 'src', 'index.ts'), 'index content')
    await writeFile(join(nestedDir, 'Button.tsx'), 'button content')

    const { stream } = await tarFileToStream('src', testDir, [], false)

    const contents = await extractTarContents(stream)
    const paths = Array.from(contents.keys())
    expect(paths.some((p) => p.includes('src'))).toBe(true)
    expect(paths.some((p) => p.includes('index.ts'))).toBe(true)
    expect(paths.some((p) => p.includes('Button.tsx'))).toBe(true)
  })

  test('should resolve symlinks when enabled', async () => {
    await writeFile(join(testDir, 'original.txt'), 'original content')

    try {
      await symlink('original.txt', join(testDir, 'link.txt'))
    } catch (error: any) {
      // Skip test if symlinks are not supported on this platform
      if (error.code === 'ENOSYS' || error.code === 'EPERM') {
        return
      }
      throw error
    }

    const { stream } = await tarFileToStream('*.txt', testDir, [], true)

    const contents = await extractTarContents(stream)
    expect(contents.get('original.txt')?.toString()).toBe('original content')
    // Symlink should be resolved (contain actual content, not link)
    expect(contents.get('link.txt')?.toString()).toBe('original content')
  })

  test('should preserve symlinks when disabled', async () => {
    await writeFile(join(testDir, 'original.txt'), 'original content')

    try {
      await symlink('original.txt', join(testDir, 'link.txt'))
    } catch (error: any) {
      // Skip test if symlinks are not supported on this platform
      if (error.code === 'ENOSYS' || error.code === 'EPERM') {
        return
      }
      throw error
    }

    const { stream } = await tarFileToStream('*.txt', testDir, [], false)

    const members = await getTarMembers(stream)
    expect(members.get('original.txt')?.type).toBe('File')
    const link = members.get('link.txt')!
    expect(link.type).toBe('SymbolicLink')
    expect(link.linkpath).toBe('original.txt')
  })

  test('removes the spooled archive once the stream is consumed', async () => {
    await writeFile(join(testDir, 'file1.txt'), 'content1')

    // Capture the temp dir the helper creates so we can assert it is gone.
    let tmpDir: string | undefined
    const mkdtemp = fs.promises.mkdtemp.bind(fs.promises)
    const spy = vi
      .spyOn(fs.promises, 'mkdtemp')
      .mockImplementation(async (prefix: any, ...rest: any[]) => {
        const dir = await mkdtemp(prefix, ...rest)
        tmpDir = dir
        return dir
      })

    try {
      const { stream } = await tarFileToStream('*.txt', testDir, [], false)
      expect(tmpDir).toBeDefined()
      await access(tmpDir!)

      // Drain the stream to completion; the `close` handler then removes the
      // spooled archive.
      stream.resume()
      await waitUntilGone(tmpDir!)
    } finally {
      spy.mockRestore()
    }
  })

  test('cleans up the spooled archive if it is never consumed', async () => {
    await writeFile(join(testDir, 'file1.txt'), 'content1')

    let tmpDir: string | undefined
    const mkdtemp = fs.promises.mkdtemp.bind(fs.promises)
    const spy = vi
      .spyOn(fs.promises, 'mkdtemp')
      .mockImplementation(async (prefix: any, ...rest: any[]) => {
        const dir = await mkdtemp(prefix, ...rest)
        tmpDir = dir
        return dir
      })

    try {
      const { stream } = await tarFileToStream('*.txt', testDir, [], false)
      await access(tmpDir!)

      // Destroying without reading still fires `close` and removes the file.
      stream.destroy()
      await waitUntilGone(tmpDir!)
    } finally {
      spy.mockRestore()
    }
  })
})
