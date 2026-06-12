import { expect, test, describe, beforeAll, afterAll, beforeEach } from 'vitest'
import { writeFile, mkdir, rm, symlink, readFile, stat } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { tarFileToTempFile } from '../../../src/template/utils'
import * as tar from 'tar'
import { ReadEntry } from 'tar'

describe('tarFileToTempFile', () => {
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
   * Extract tar contents into a dictionary mapping paths to file contents.
   */
  async function extractTarContents(
    tarFile: string
  ): Promise<Map<string, Buffer | null>> {
    const contents = new Map<string, Buffer | null>()

    // Extract files to a temp directory and collect members
    const extractDir = join(tmpdir(), `tar-extract-${Date.now()}`)
    await mkdir(extractDir, { recursive: true })

    const members: ReadEntry[] = []
    await tar.extract({
      file: tarFile,
      cwd: extractDir,
      gzip: true,
      onentry: (entry: ReadEntry) => {
        members.push(entry)
      },
    })

    // Read file contents
    for (const member of members) {
      if (member.type === 'File') {
        const filePath = join(extractDir, member.path)
        try {
          const content = await readFile(filePath)
          contents.set(member.path, content)
        } catch {
          // File might not exist
        }
      } else if (member.type === 'Directory') {
        contents.set(member.path, null)
      } else if (member.type === 'SymbolicLink') {
        contents.set(member.path, Buffer.from(member.linkpath || ''))
      }
    }

    // Cleanup
    await rm(extractDir, { recursive: true, force: true })

    return contents
  }

  /**
   * Get tar members
   */
  async function getTarMembers(
    tarFile: string
  ): Promise<Map<string, ReadEntry>> {
    const members = new Map<string, ReadEntry>()

    const extractDir = join(tmpdir(), `tar-extract-${Date.now()}`)
    await mkdir(extractDir, { recursive: true })

    await tar.extract({
      file: tarFile,
      cwd: extractDir,
      gzip: true,
      onentry: (entry: ReadEntry) => {
        members.set(entry.path, entry)
      },
    })

    // Cleanup
    await rm(extractDir, { recursive: true, force: true })

    return members
  }

  test('should create tar with simple files', async () => {
    // Create test files
    await writeFile(join(testDir, 'file1.txt'), 'content1')
    await writeFile(join(testDir, 'file2.txt'), 'content2')

    const { path, size, cleanup } = await tarFileToTempFile(
      '*.txt',
      testDir,
      [],
      false
    )
    try {
      expect(size).toBe((await stat(path)).size)
      expect(size).toBeGreaterThan(0)

      const contents = await extractTarContents(path)

      expect(contents.size).toBe(2)
      expect(contents.has('file1.txt')).toBe(true)
      expect(contents.has('file2.txt')).toBe(true)
      expect(contents.get('file1.txt')?.toString()).toBe('content1')
      expect(contents.get('file2.txt')?.toString()).toBe('content2')
    } finally {
      await cleanup()
    }

    // Cleanup removes the temporary archive
    await expect(stat(path)).rejects.toThrow()
  })

  test('should respect ignore patterns', async () => {
    // Create test files
    await writeFile(join(testDir, 'file1.txt'), 'content1')
    await writeFile(join(testDir, 'file2.txt'), 'content2')
    await writeFile(join(testDir, 'temp.txt'), 'temp content')
    await writeFile(join(testDir, 'backup.txt'), 'backup content')

    const { path, cleanup } = await tarFileToTempFile(
      '*.txt',
      testDir,
      ['temp*', 'backup*'],
      false
    )
    try {
      const contents = await extractTarContents(path)

      expect(contents.size).toBe(2)
      expect(contents.has('file1.txt')).toBe(true)
      expect(contents.has('file2.txt')).toBe(true)
      expect(contents.get('file1.txt')?.toString()).toBe('content1')
      expect(contents.get('file2.txt')?.toString()).toBe('content2')
      expect(contents.has('temp.txt')).toBe(false)
      expect(contents.has('backup.txt')).toBe(false)
    } finally {
      await cleanup()
    }
  })

  test('should handle nested files', async () => {
    // Create nested directory structure
    const nestedDir = join(testDir, 'src', 'components')
    await mkdir(nestedDir, { recursive: true })

    await writeFile(join(testDir, 'src', 'index.ts'), 'index content')
    await writeFile(join(nestedDir, 'Button.tsx'), 'button content')

    const { path, cleanup } = await tarFileToTempFile('src', testDir, [], false)
    try {
      const contents = await extractTarContents(path)

      // Should include the directory and files
      const paths = Array.from(contents.keys())
      expect(paths.some((p) => p.includes('src'))).toBe(true)
      expect(paths.some((p) => p.includes('index.ts'))).toBe(true)
      expect(paths.some((p) => p.includes('Button.tsx'))).toBe(true)
    } finally {
      await cleanup()
    }
  })

  test('should resolve symlinks when enabled', async () => {
    // Create original file
    const originalPath = join(testDir, 'original.txt')
    await writeFile(originalPath, 'original content')

    // Create symlink
    const symlinkPath = join(testDir, 'link.txt')
    try {
      await symlink('original.txt', symlinkPath)
    } catch (error: any) {
      // Skip test if symlinks are not supported on this platform
      if (error.code === 'ENOSYS' || error.code === 'EPERM') {
        return
      }
      throw error
    }

    // Test with resolveSymlinks=true
    const { path, cleanup } = await tarFileToTempFile(
      '*.txt',
      testDir,
      [],
      true
    )
    try {
      const contents = await extractTarContents(path)

      // Both files should be in tar
      expect(contents.has('original.txt')).toBe(true)
      expect(contents.has('link.txt')).toBe(true)
      // Symlink should be resolved (contain actual content, not link)
      expect(contents.get('original.txt')?.toString()).toBe('original content')
      expect(contents.get('link.txt')?.toString()).toBe('original content')
    } finally {
      await cleanup()
    }
  })

  test('should preserve symlinks when disabled', async () => {
    // Create original file
    const originalPath = join(testDir, 'original.txt')
    await writeFile(originalPath, 'original content')

    // Create symlink
    const symlinkPath = join(testDir, 'link.txt')
    try {
      await symlink('original.txt', symlinkPath)
    } catch (error: any) {
      // Skip test if symlinks are not supported on this platform
      if (error.code === 'ENOSYS' || error.code === 'EPERM') {
        return
      }
      throw error
    }

    // Test with resolveSymlinks=false
    const { path, cleanup } = await tarFileToTempFile(
      '*.txt',
      testDir,
      [],
      false
    )
    try {
      const members = await getTarMembers(path)

      // Both files should be in tar
      expect(members.has('original.txt')).toBe(true)
      expect(members.has('link.txt')).toBe(true)

      // Original should be a regular file
      const original = members.get('original.txt')!
      expect(original.type).toBe('File')

      // Link should be a symlink
      const link = members.get('link.txt')!
      expect(link.type).toBe('SymbolicLink')
      expect(link.linkpath).toBe('original.txt')
    } finally {
      await cleanup()
    }
  })
})
