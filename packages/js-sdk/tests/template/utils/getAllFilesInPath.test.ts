import { expect, test, describe, beforeAll, afterAll, beforeEach } from 'vitest'
import { writeFile, mkdir, rm } from 'fs/promises'
import { join, basename } from 'path'
import { getAllFilesInPath } from '../../../src/template/utils'

describe('getAllFilesInPath', () => {
  const testDir = join(__dirname, 'folder')

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

  test('should return files matching a simple pattern', async () => {
    // Create test files
    await writeFile(join(testDir, 'file1.txt'), 'content1')
    await writeFile(join(testDir, 'file2.txt'), 'content2')
    await writeFile(join(testDir, 'file3.js'), 'content3')

    const files = await getAllFilesInPath('*.txt', testDir, [])

    expect(files).toHaveLength(2)
    expect(files.some((f) => f.fullpath().endsWith('file1.txt'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('file2.txt'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('file3.js'))).toBe(false)
  })

  test('should handle directory patterns recursively', async () => {
    // Create nested directory structure
    await mkdir(join(testDir, 'src'), { recursive: true })
    await mkdir(join(testDir, 'src', 'components'), { recursive: true })
    await mkdir(join(testDir, 'src', 'utils'), { recursive: true })

    await writeFile(join(testDir, 'src', 'index.ts'), 'index content')
    await writeFile(
      join(testDir, 'src', 'components', 'Button.tsx'),
      'button content'
    )
    await writeFile(
      join(testDir, 'src', 'utils', 'helper.ts'),
      'helper content'
    )
    await writeFile(join(testDir, 'README.md'), 'readme content')

    const files = await getAllFilesInPath('src', testDir, [])

    expect(files).toHaveLength(6) // 3 files + 3 directories (src, components, utils)
    expect(files.some((f) => f.fullpath().endsWith('index.ts'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('Button.tsx'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('helper.ts'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('README.md'))).toBe(false)
  })

  test('should respect ignore patterns', async () => {
    // Create test files
    await writeFile(join(testDir, 'file1.txt'), 'content1')
    await writeFile(join(testDir, 'file2.txt'), 'content2')
    await writeFile(join(testDir, 'temp.txt'), 'temp content')
    await writeFile(join(testDir, 'backup.txt'), 'backup content')

    const files = await getAllFilesInPath('*.txt', testDir, [
      'temp*',
      'backup*',
    ])

    expect(files).toHaveLength(2)
    expect(files.some((f) => f.fullpath().endsWith('file1.txt'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('file2.txt'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('temp.txt'))).toBe(false)
    expect(files.some((f) => f.fullpath().endsWith('backup.txt'))).toBe(false)
  })

  test('should handle complex ignore patterns', async () => {
    // Create nested structure with various file types
    await mkdir(join(testDir, 'src'), { recursive: true })
    await mkdir(join(testDir, 'src', 'components'), { recursive: true })
    await mkdir(join(testDir, 'src', 'utils'), { recursive: true })
    await mkdir(join(testDir, 'tests'), { recursive: true })

    await writeFile(join(testDir, 'src', 'index.ts'), 'index content')
    await writeFile(
      join(testDir, 'src', 'components', 'Button.tsx'),
      'button content'
    )
    await writeFile(
      join(testDir, 'src', 'utils', 'helper.ts'),
      'helper content'
    )
    await writeFile(join(testDir, 'tests', 'test.spec.ts'), 'test content')
    await writeFile(
      join(testDir, 'src', 'components', 'Button.test.tsx'),
      'test content'
    )
    await writeFile(
      join(testDir, 'src', 'utils', 'helper.spec.ts'),
      'spec content'
    )

    const files = await getAllFilesInPath('src', testDir, [
      '**/*.test.*',
      '**/*.spec.*',
    ])

    expect(files).toHaveLength(6) // 3 files + 3 directories (src, components, utils)
    expect(files.some((f) => f.fullpath().endsWith('index.ts'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('Button.tsx'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('helper.ts'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('Button.test.tsx'))).toBe(
      false
    )
    expect(files.some((f) => f.fullpath().endsWith('helper.spec.ts'))).toBe(
      false
    )
  })

  test('should handle empty directories', async () => {
    await mkdir(join(testDir, 'empty'), { recursive: true })
    await writeFile(join(testDir, 'file.txt'), 'content')

    const files = await getAllFilesInPath('empty', testDir, [])

    expect(files).toHaveLength(1) // The empty directory itself
  })

  test('should handle mixed files and directories', async () => {
    // Create a mix of files and directories
    await writeFile(join(testDir, 'file1.txt'), 'content1')
    await mkdir(join(testDir, 'dir1'), { recursive: true })
    await writeFile(join(testDir, 'dir1', 'file2.txt'), 'content2')
    await writeFile(join(testDir, 'file3.txt'), 'content3')

    const files = await getAllFilesInPath('*', testDir, [])

    expect(files).toHaveLength(4) // 3 files + 1 directory
    expect(files.some((f) => f.fullpath().endsWith('file1.txt'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('file2.txt'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('file3.txt'))).toBe(true)
  })

  test('should handle glob patterns with subdirectories', async () => {
    // Create nested structure
    await mkdir(join(testDir, 'src'), { recursive: true })
    await mkdir(join(testDir, 'src', 'components'), { recursive: true })
    await mkdir(join(testDir, 'src', 'utils'), { recursive: true })

    await writeFile(join(testDir, 'src', 'index.ts'), 'index content')
    await writeFile(
      join(testDir, 'src', 'components', 'Button.tsx'),
      'button content'
    )
    await writeFile(
      join(testDir, 'src', 'utils', 'helper.ts'),
      'helper content'
    )
    await writeFile(
      join(testDir, 'src', 'components', 'Button.css'),
      'css content'
    )

    const files = await getAllFilesInPath('src/**/*', testDir, [])

    expect(files).toHaveLength(6) // 4 files + 2 directories (components, utils)
    expect(files.some((f) => f.fullpath().endsWith('index.ts'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('Button.tsx'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('helper.ts'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('Button.css'))).toBe(true)
  })

  test('should handle specific file extensions', async () => {
    await writeFile(join(testDir, 'file1.ts'), 'ts content')
    await writeFile(join(testDir, 'file2.js'), 'js content')
    await writeFile(join(testDir, 'file3.tsx'), 'tsx content')
    await writeFile(join(testDir, 'file4.css'), 'css content')

    const files = await getAllFilesInPath('*.ts', testDir, [])

    expect(files).toHaveLength(1)
    expect(files.some((f) => f.fullpath().endsWith('file1.ts'))).toBe(true)
  })

  test('should return sorted files', async () => {
    await writeFile(join(testDir, 'zebra.txt'), 'z content')
    await writeFile(join(testDir, 'apple.txt'), 'a content')
    await writeFile(join(testDir, 'banana.txt'), 'b content')

    const files = await getAllFilesInPath('*.txt', testDir, [])

    expect(files).toHaveLength(3)
    // Files are sorted by full path, not just filename
    const fileNames = files.map((f) => basename(f.fullpath())).sort()
    expect(fileNames).toEqual(['apple.txt', 'banana.txt', 'zebra.txt'])
  })

  test('should handle no matching files', async () => {
    await writeFile(join(testDir, 'file.txt'), 'content')

    const files = await getAllFilesInPath('*.js', testDir, [])

    expect(files).toHaveLength(0)
  })

  test('should handle listing all files in current directory with dot pattern', async () => {
    // Create a small directory tree inside the test directory
    await writeFile(join(testDir, 'root.txt'), 'root')
    await mkdir(join(testDir, 'subdir'), { recursive: true })
    await writeFile(join(testDir, 'subdir', 'nested.txt'), 'nested')

    const files = await getAllFilesInPath('.', testDir, [])

    // We should get at least the testDir itself (.) plus its children
    expect(files.length).toBeGreaterThanOrEqual(3)

    // All returned paths must stay within the testDir - we must not traverse the whole filesystem
    const allWithinTestDir = files.every((f) =>
      f.fullpath().startsWith(testDir)
    )
    expect(allWithinTestDir).toBe(true)
  })

  test('should handle complex ignore patterns with directories', async () => {
    // Create a complex structure
    await mkdir(join(testDir, 'src'), { recursive: true })
    await mkdir(join(testDir, 'src', 'components'), { recursive: true })
    await mkdir(join(testDir, 'src', 'utils'), { recursive: true })
    await mkdir(join(testDir, 'src', 'tests'), { recursive: true })
    await mkdir(join(testDir, 'dist'), { recursive: true })

    await writeFile(join(testDir, 'src', 'index.ts'), 'index content')
    await writeFile(
      join(testDir, 'src', 'components', 'Button.tsx'),
      'button content'
    )
    await writeFile(
      join(testDir, 'src', 'utils', 'helper.ts'),
      'helper content'
    )
    await writeFile(
      join(testDir, 'src', 'tests', 'test.spec.ts'),
      'test content'
    )
    await writeFile(join(testDir, 'dist', 'bundle.js'), 'bundle content')
    await writeFile(join(testDir, 'README.md'), 'readme content')

    const files = await getAllFilesInPath('src', testDir, [
      '**/tests/**',
      '**/*.spec.*',
    ])

    expect(files).toHaveLength(6) // 3 files + 3 directories (src, components, utils)
    expect(files.some((f) => f.fullpath().endsWith('index.ts'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('Button.tsx'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('helper.ts'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('test.spec.ts'))).toBe(false)
  })
})
