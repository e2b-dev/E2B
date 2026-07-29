import { expect, test, describe, beforeAll, afterAll, beforeEach } from 'vitest'
import { writeFile, mkdir, rm, symlink, readFile, access } from 'fs/promises'
import { join, dirname } from 'path'
import { tmpdir } from 'os'
import { spoolTarArchive } from '../../../src/template/utils'
import * as tar from 'tar'
import { ReadEntry } from 'tar'

describe('spoolTarArchive', () => {
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
   * Extract a spooled archive and collect its entries, then remove the spool.
   */
  async function extractTarArchive(
    archive: Awaited<ReturnType<typeof spoolTarArchive>>
  ): Promise<{ extractDir: string; members: ReadEntry[] }> {
    const extractDir = join(
      tmpdir(),
      `tar-extract-${Date.now()}-${Math.random()}`
    )
    await mkdir(extractDir, { recursive: true })

    const members: ReadEntry[] = []
    try {
      await tar.extract({
        file: archive.path,
        cwd: extractDir,
        onentry: (entry: ReadEntry) => {
          members.push(entry)
        },
      })
    } finally {
      await archive.cleanup()
    }

    return { extractDir, members }
  }

  /**
   * Extract archive contents into a map of path -> file contents.
   */
  async function extractTarContents(
    archive: Awaited<ReturnType<typeof spoolTarArchive>>
  ): Promise<Map<string, Buffer | null>> {
    const { extractDir, members } = await extractTarArchive(archive)
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
    archive: Awaited<ReturnType<typeof spoolTarArchive>>
  ): Promise<Map<string, ReadEntry>> {
    const { extractDir, members } = await extractTarArchive(archive)
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

    const archive = await spoolTarArchive('*.txt', testDir, [], false, true)
    expect(archive.size).toBeGreaterThan(0)

    const contents = await extractTarContents(archive)

    expect(contents.size).toBe(2)
    expect(contents.get('file1.txt')?.toString()).toBe('content1')
    expect(contents.get('file2.txt')?.toString()).toBe('content2')
  })

  test('should create an uncompressed tar when gzip is disabled', async () => {
    await writeFile(join(testDir, 'file1.txt'), 'content1')
    await writeFile(join(testDir, 'file2.txt'), 'content2')

    const archive = await spoolTarArchive('*.txt', testDir, [], false, false)

    try {
      const raw = await readFile(archive.path)

      // gzip streams start with the magic bytes 0x1f 0x8b — an uncompressed tar must not
      expect(raw[0]).not.toBe(0x1f)
      expect(raw.subarray(0, 2).equals(Buffer.from([0x1f, 0x8b]))).toBe(false)

      // And it should still extract to the original files
      const extractDir = join(
        tmpdir(),
        `tar-uncompressed-extract-${Date.now()}`
      )
      await mkdir(extractDir, { recursive: true })
      await tar.extract({ file: archive.path, cwd: extractDir })
      expect((await readFile(join(extractDir, 'file1.txt'))).toString()).toBe(
        'content1'
      )
      expect((await readFile(join(extractDir, 'file2.txt'))).toString()).toBe(
        'content2'
      )
      await rm(extractDir, { recursive: true, force: true })
    } finally {
      await archive.cleanup()
    }
  })

  test('should respect ignore patterns', async () => {
    await writeFile(join(testDir, 'file1.txt'), 'content1')
    await writeFile(join(testDir, 'file2.txt'), 'content2')
    await writeFile(join(testDir, 'temp.txt'), 'temp content')
    await writeFile(join(testDir, 'backup.txt'), 'backup content')

    const archive = await spoolTarArchive(
      '*.txt',
      testDir,
      ['temp*', 'backup*'],
      false,
      true
    )

    const contents = await extractTarContents(archive)

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

    const archive = await spoolTarArchive('src', testDir, [], false, true)

    const contents = await extractTarContents(archive)
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

    // Test with resolveSymlinks=true
    const archive = await spoolTarArchive('*.txt', testDir, [], true, true)

    const contents = await extractTarContents(archive)
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

    // Test with resolveSymlinks=false
    const archive = await spoolTarArchive('*.txt', testDir, [], false, true)

    const members = await getTarMembers(archive)
    expect(members.get('original.txt')?.type).toBe('File')
    const link = members.get('link.txt')!
    expect(link.type).toBe('SymbolicLink')
    expect(link.linkpath).toBe('original.txt')
  })

  test('cleanup removes the spooled archive and its temp dir', async () => {
    await writeFile(join(testDir, 'file1.txt'), 'content1')

    const archive = await spoolTarArchive('*.txt', testDir, [], false, true)
    const spoolDir = dirname(archive.path)
    await access(spoolDir)

    await archive.cleanup()

    await expect(access(spoolDir)).rejects.toThrow()
    // Cleanup is idempotent
    await archive.cleanup()
  })
})
