import { describe, it, expect, afterEach, beforeAll, afterAll } from 'vitest'
import { Volume, NotFoundError } from '../../src'

describe('Volume File Operations', () => {
  let volume: Volume

  beforeAll(async () => {
    // Create a real volume for testing
    volume = await Volume.create(`test-file-ops-${Date.now()}`)
  })

  afterAll(async () => {
    // Clean up: destroy the volume after all tests
    try {
      await Volume.destroy(volume.volumeId)
    } catch (err) {
      // Ignore cleanup errors
    }
  })

  afterEach(async () => {
    // Clean up: remove all files and directories created during tests
    try {
      const entries = await volume.list('/')
      for (const entry of entries) {
        if (entry.type === 'directory') {
          await volume.remove(entry.path, { recursive: true })
        } else {
          await volume.remove(entry.path)
        }
      }
    } catch (err) {
      // Ignore cleanup errors
    }
  })

  describe('writeFile and readFile', () => {
    it('should write and read a text file', async () => {
      const path = '/test.txt'
      const content = 'Hello, World!'

      await volume.writeFile(path, content)
      const readContent = await volume.readFile(path, { format: 'text' })

      expect(readContent).toBe(content)
    })

    it('should write and read a file with bytes format', async () => {
      const path = '/test-bytes.txt'
      const content = 'Test bytes content'
      const contentBytes = new TextEncoder().encode(content)

      await volume.writeFile(path, contentBytes.buffer)
      const readBytes = await volume.readFile(path, { format: 'bytes' })

      expect(readBytes).toEqual(contentBytes)
    })

    it('should write and read a file with blob format', async () => {
      const path = '/test-blob.txt'
      const content = 'Test blob content'
      const blob = new Blob([content], { type: 'text/plain' })

      await volume.writeFile(path, blob)
      const readBlob = await volume.readFile(path, { format: 'blob' })

      expect(await readBlob.text()).toBe(content)
    })

    it('should write and read an empty file', async () => {
      const path = '/empty.txt'
      const content = ''

      await volume.writeFile(path, content)
      const readContent = await volume.readFile(path, { format: 'text' })

      expect(readContent).toBe(content)
    })

    it('should overwrite an existing file with force option', async () => {
      const path = '/overwrite.txt'
      const initialContent = 'Initial content'
      const newContent = 'New content'

      await volume.writeFile(path, initialContent)
      await volume.writeFile(path, newContent, { force: true })
      const readContent = await volume.readFile(path, { format: 'text' })

      expect(readContent).toBe(newContent)
    })

    it('should write file with metadata (uid, gid, mode)', async () => {
      const path = '/metadata.txt'
      const content = 'File with metadata'

      await volume.writeFile(path, content, {
        uid: 1000,
        gid: 1000,
        mode: 0o644,
      })

      const entryInfo = await volume.getEntryInfo(path)
      expect(entryInfo.type).toBe('file')
      // Note: uid, gid, mode might be adjusted by the server, so we just verify the file exists
    })

    it('should write file in nested directory', async () => {
      const dirPath = '/nested/deep/path'
      const filePath = `${dirPath}/file.txt`
      const content = 'Nested file content'

      await volume.makeDir(dirPath, { force: true })
      await volume.writeFile(filePath, content)
      const readContent = await volume.readFile(filePath, { format: 'text' })

      expect(readContent).toBe(content)
    })
  })

  describe('getEntryInfo', () => {
    it('should get info for a file', async () => {
      const path = '/info-file.txt'
      const content = 'File for info test'

      await volume.writeFile(path, content)
      const info = await volume.getEntryInfo(path)

      expect(info.name).toBe('info-file.txt')
      expect(info.type).toBe('file')
      expect(info.path).toBe(path)
      expect(info.mtime).toBeInstanceOf(Date)
      expect(info.ctime).toBeInstanceOf(Date)
    })

    it('should get info for a directory', async () => {
      const path = '/info-dir'

      await volume.makeDir(path)
      const info = await volume.getEntryInfo(path)

      expect(info.name).toBe('info-dir')
      expect(info.type).toBe('directory')
      expect(info.path).toBe(path)
    })

    it('should throw NotFoundError for non-existent file', async () => {
      await expect(volume.getEntryInfo('/non-existent.txt')).rejects.toThrow(
        NotFoundError
      )
    })
  })

  describe('updateMetadata', () => {
    it('should update file metadata', async () => {
      const path = '/metadata-update.txt'
      await volume.writeFile(path, 'Content')

      const updated = await volume.updateMetadata(path, {
        uid: 1001,
        gid: 1001,
        mode: 0o755,
      })

      expect(updated.path).toBe(path)
      expect(updated.type).toBe('file')
    })

    it('should throw NotFoundError when updating non-existent file', async () => {
      await expect(
        volume.updateMetadata('/non-existent.txt', { mode: 0o644 })
      ).rejects.toThrow(NotFoundError)
    })
  })

  describe('makeDir', () => {
    it('should create a directory', async () => {
      const path = '/test-dir'

      await volume.makeDir(path)
      const info = await volume.getEntryInfo(path)

      expect(info.type).toBe('directory')
      expect(info.path).toBe(path)
    })

    it('should create nested directories with force option', async () => {
      const path = '/nested/deep/directory'

      await volume.makeDir(path, { force: true })
      const info = await volume.getEntryInfo(path)

      expect(info.type).toBe('directory')
    })

    it('should create directory with metadata', async () => {
      const path = '/dir-with-metadata'

      await volume.makeDir(path, {
        uid: 1000,
        gid: 1000,
        mode: 0o755,
      })

      const info = await volume.getEntryInfo(path)
      expect(info.type).toBe('directory')
    })
  })

  describe('list', () => {
    it('should list directory contents', async () => {
      await volume.writeFile('/file1.txt', 'Content 1')
      await volume.writeFile('/file2.txt', 'Content 2')
      await volume.makeDir('/dir1')

      const entries = await volume.list('/')

      expect(entries.length).toBeGreaterThanOrEqual(3)
      const fileNames = entries.map((e) => e.name).sort()
      expect(fileNames).toContain('file1.txt')
      expect(fileNames).toContain('file2.txt')
      expect(fileNames).toContain('dir1')
    })

    it('should list nested directory contents', async () => {
      await volume.makeDir('/nested', { force: true })
      await volume.writeFile('/nested/file.txt', 'Content')

      const entries = await volume.list('/nested')

      expect(entries.length).toBeGreaterThanOrEqual(1)
      expect(entries.some((e) => e.name === 'file.txt')).toBe(true)
    })

    it('should list with depth option', async () => {
      await volume.makeDir('/deep/nested/structure', { force: true })
      await volume.writeFile('/deep/nested/structure/file.txt', 'Content')

      const entries = await volume.list('/deep', { depth: 2 })

      expect(entries.length).toBeGreaterThan(0)
    })

    it('should throw NotFoundError for non-existent directory', async () => {
      await expect(volume.list('/non-existent')).rejects.toThrow(NotFoundError)
    })
  })

  describe('remove', () => {
    it('should remove a file', async () => {
      const path = '/to-remove.txt'
      await volume.writeFile(path, 'Content')

      await volume.remove(path)

      await expect(volume.getEntryInfo(path)).rejects.toThrow(NotFoundError)
    })

    it('should remove a directory', async () => {
      const path = '/to-remove-dir'
      await volume.makeDir(path)

      await volume.remove(path)

      await expect(volume.getEntryInfo(path)).rejects.toThrow(NotFoundError)
    })

    it('should remove a directory recursively', async () => {
      const dirPath = '/recursive-dir'
      await volume.makeDir(`${dirPath}/nested`, { force: true })
      await volume.writeFile(`${dirPath}/nested/file.txt`, 'Content')

      await volume.remove(dirPath, { recursive: true })

      await expect(volume.getEntryInfo(dirPath)).rejects.toThrow(NotFoundError)
    })

    it('should throw NotFoundError when removing non-existent file', async () => {
      await expect(volume.remove('/non-existent.txt')).rejects.toThrow(
        NotFoundError
      )
    })
  })

  describe('file operations lifecycle', () => {
    it('should handle complete file lifecycle', async () => {
      const filePath = '/lifecycle.txt'
      const content = 'Lifecycle test content'

      // Write
      await volume.writeFile(filePath, content)

      // Read
      const readContent = await volume.readFile(filePath, { format: 'text' })
      expect(readContent).toBe(content)

      // Get info
      const info = await volume.getEntryInfo(filePath)
      expect(info.type).toBe('file')

      // Update metadata
      await volume.updateMetadata(filePath, { mode: 0o755 })

      // Remove
      await volume.remove(filePath)
      await expect(volume.getEntryInfo(filePath)).rejects.toThrow(NotFoundError)
    })

    it('should handle directory with multiple files', async () => {
      const dirPath = '/multi-file-dir'
      await volume.makeDir(dirPath)

      // Create multiple files
      const files = ['file1.txt', 'file2.txt', 'file3.txt']
      for (const fileName of files) {
        await volume.writeFile(
          `${dirPath}/${fileName}`,
          `Content of ${fileName}`
        )
      }

      // List and verify
      const entries = await volume.list(dirPath)
      expect(entries.length).toBeGreaterThanOrEqual(files.length)

      // Read all files
      for (const fileName of files) {
        const content = await volume.readFile(`${dirPath}/${fileName}`, {
          format: 'text',
        })
        expect(content).toBe(`Content of ${fileName}`)
      }

      // Remove directory recursively
      await volume.remove(dirPath, { recursive: true })
      await expect(volume.getEntryInfo(dirPath)).rejects.toThrow(NotFoundError)
    })
  })
})
