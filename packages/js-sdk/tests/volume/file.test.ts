import { describe, expect } from 'vitest'
import { NotFoundError } from '../../src'
import { volumeTest } from '../setup'

describe('Volume File Operations', () => {
  describe('writeFile and readFile', () => {
    volumeTest('should write and read a text file', async ({ volume }) => {
      const path = '/test.txt'
      const content = 'Hello, World!'

      const stat = await volume.writeFile(path, content)
      expect(stat.name).toBe('test.txt')
      expect(stat.type).toBe('file')
      expect(stat.path).toBe(path)
      expect(stat.atime).toBeInstanceOf(Date)
      expect(stat.mtime).toBeInstanceOf(Date)
      expect(stat.ctime).toBeInstanceOf(Date)

      const readContent = await volume.readFile(path, { format: 'text' })
      expect(readContent).toBe(content)
    })

    volumeTest(
      'should write and read a file with bytes format',
      async ({ volume }) => {
        const path = '/test-bytes.txt'
        const content = 'Test bytes content'
        const contentBytes = new TextEncoder().encode(content)

        await volume.writeFile(path, contentBytes.buffer)
        const readBytes = await volume.readFile(path, { format: 'bytes' })

        expect(readBytes).toEqual(contentBytes)
      }
    )

    volumeTest(
      'should write and read a file with blob format',
      async ({ volume }) => {
        const path = '/test-blob.txt'
        const content = 'Test blob content'
        const blob = new Blob([content], { type: 'text/plain' })

        await volume.writeFile(path, blob)
        const readBlob = await volume.readFile(path, { format: 'blob' })

        expect(await readBlob.text()).toBe(content)
      }
    )

    volumeTest('should write and read an empty file', async ({ volume }) => {
      const path = '/empty.txt'
      const content = ''

      await volume.writeFile(path, content)
      const readContent = await volume.readFile(path, { format: 'text' })

      expect(readContent).toBe(content)
    })

    volumeTest(
      'should overwrite an existing file with force option',
      async ({ volume }) => {
        const path = '/overwrite.txt'
        const initialContent = 'Initial content'
        const newContent = 'New content'

        await volume.writeFile(path, initialContent)
        await volume.writeFile(path, newContent, { force: true })
        const readContent = await volume.readFile(path, { format: 'text' })

        expect(readContent).toBe(newContent)
      }
    )

    volumeTest(
      'should write file with metadata (uid, gid, mode)',
      async ({ volume }) => {
        const path = '/metadata.txt'
        const content = 'File with metadata'

        const stat = await volume.writeFile(path, content, {
          uid: 1000,
          gid: 1000,
          mode: 0o644,
        })

        expect(stat.type).toBe('file')
        expect(stat.uid).toBe(1000)
        expect(stat.gid).toBe(1000)
        expect(stat.mode).toBe(0o644)
      }
    )

    volumeTest('should write file in nested directory', async ({ volume }) => {
      const dirPath = '/nested/deep/path'
      const filePath = `${dirPath}/file.txt`
      const content = 'Nested file content'

      await volume.makeDir(dirPath, { force: true })
      await volume.writeFile(filePath, content)
      const readContent = await volume.readFile(filePath, { format: 'text' })

      expect(readContent).toBe(content)
    })
  })

  describe('getInfo', () => {
    volumeTest('should get info for a file', async ({ volume }) => {
      const path = '/info-file.txt'
      const content = 'File for info test'

      await volume.writeFile(path, content)
      const info = await volume.getInfo(path)

      expect(info.name).toBe('info-file.txt')
      expect(info.type).toBe('file')
      expect(info.path).toBe(path)
      expect(info.atime).toBeInstanceOf(Date)
      expect(info.mtime).toBeInstanceOf(Date)
      expect(info.ctime).toBeInstanceOf(Date)
    })

    volumeTest('should get info for a directory', async ({ volume }) => {
      const path = '/info-dir'

      await volume.makeDir(path)
      const info = await volume.getInfo(path)

      expect(info.name).toBe('info-dir')
      expect(info.type).toBe('directory')
      expect(info.path).toBe(path)
    })

    volumeTest(
      'should return false from exists for non-existent file',
      async ({ volume }) => {
        expect(await volume.exists('/non-existent.txt')).toBe(false)
      }
    )
  })

  describe('updateMetadata', () => {
    volumeTest('should update file metadata', async ({ volume }) => {
      const path = '/metadata-update.txt'
      await volume.writeFile(path, 'Content')

      const updated = await volume.updateMetadata(path, {
        uid: 1001,
        gid: 1001,
        mode: 0o755,
      })

      expect(updated.path).toBe(path)
      expect(updated.type).toBe('file')
      expect(updated.uid).toBe(1001)
      expect(updated.gid).toBe(1001)
      expect(updated.mode).toBe(0o755)
    })

    volumeTest(
      'should throw NotFoundError when updating non-existent file',
      async ({ volume }) => {
        await expect(
          volume.updateMetadata('/non-existent.txt', { mode: 0o644 })
        ).rejects.toThrow(NotFoundError)
      }
    )
  })

  describe('makeDir', () => {
    volumeTest('should create a directory', async ({ volume }) => {
      const path = '/test-dir'

      const stat = await volume.makeDir(path)

      expect(stat.type).toBe('directory')
      expect(stat.path).toBe(path)
      expect(stat.atime).toBeInstanceOf(Date)
      expect(stat.mtime).toBeInstanceOf(Date)
      expect(stat.ctime).toBeInstanceOf(Date)
    })

    volumeTest(
      'should create nested directories with force option',
      async ({ volume }) => {
        const path = '/nested/deep/directory'

        const stat = await volume.makeDir(path, { force: true })

        expect(stat.type).toBe('directory')
      }
    )

    volumeTest('should create directory with metadata', async ({ volume }) => {
      const path = '/dir-with-metadata'

      const stat = await volume.makeDir(path, {
        uid: 1000,
        gid: 1000,
        mode: 0o755,
      })

      expect(stat.type).toBe('directory')
      expect(stat.uid).toBe(1000)
      expect(stat.gid).toBe(1000)
      expect(stat.mode & 0o777).toBe(0o755)
    })
  })

  describe('list', () => {
    volumeTest('should list directory contents', async ({ volume }) => {
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

    volumeTest('should list nested directory contents', async ({ volume }) => {
      await volume.makeDir('/nested', { force: true })
      await volume.writeFile('/nested/file.txt', 'Content')

      const entries = await volume.list('/nested')

      expect(entries.length).toBeGreaterThanOrEqual(1)
      expect(entries.some((e) => e.name === 'file.txt')).toBe(true)
    })

    volumeTest.skip('should list with depth option', async ({ volume }) => {
      await volume.makeDir('/deep/nested/structure', { force: true })
      await volume.writeFile('/deep/nested/structure/file.txt', 'Content')

      const entries = await volume.list('/deep', { depth: 2 })

      expect(entries.length).toBeGreaterThan(0)
    })

    volumeTest(
      'should throw NotFoundError for non-existent directory',
      async ({ volume }) => {
        await expect(volume.list('/non-existent')).rejects.toThrow(
          NotFoundError
        )
      }
    )
  })

  describe('remove', () => {
    volumeTest('should remove a file', async ({ volume }) => {
      const path = '/to-remove.txt'
      await volume.writeFile(path, 'Content')

      await volume.remove(path)

      expect(await volume.exists(path)).toBe(false)
    })

    volumeTest('should remove a directory', async ({ volume }) => {
      const path = '/to-remove-dir'
      await volume.makeDir(path)

      await volume.remove(path)

      expect(await volume.exists(path)).toBe(false)
    })

    volumeTest('should remove a directory recursively', async ({ volume }) => {
      const dirPath = '/recursive-dir'
      await volume.makeDir(`${dirPath}/nested`, { force: true })
      await volume.writeFile(`${dirPath}/nested/file.txt`, 'Content')

      await volume.remove(dirPath, { recursive: true })

      expect(await volume.exists(dirPath)).toBe(false)
    })

    volumeTest(
      'should throw NotFoundError when removing non-existent file',
      async ({ volume }) => {
        await expect(volume.remove('/non-existent.txt')).rejects.toThrow(
          NotFoundError
        )
      }
    )
  })

  describe('file operations lifecycle', () => {
    volumeTest(
      'should handle directory with multiple files',
      async ({ volume }) => {
        const dirPath = '/multi-file-dir'
        await volume.makeDir(dirPath)

        const files = ['file1.txt', 'file2.txt', 'file3.txt']
        for (const fileName of files) {
          await volume.writeFile(
            `${dirPath}/${fileName}`,
            `Content of ${fileName}`
          )
        }

        const entries = await volume.list(dirPath)
        expect(entries.length).toBeGreaterThanOrEqual(files.length)

        for (const fileName of files) {
          const content = await volume.readFile(`${dirPath}/${fileName}`, {
            format: 'text',
          })
          expect(content).toBe(`Content of ${fileName}`)
        }

        await volume.remove(dirPath, { recursive: true })
        expect(await volume.exists(dirPath)).toBe(false)
      }
    )
  })
})
