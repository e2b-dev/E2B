import { expect, test, describe, beforeAll, afterAll, beforeEach } from 'vitest'
import { appendFile, writeFile, mkdir, mkdtemp, rm, symlink } from 'fs/promises'
import { tmpdir } from 'os'
import { join, basename, relative } from 'path'
import {
  calculateFilesHash,
  getAllFilesInPath,
  readDockerignore,
} from '../../../src/template/utils'

describe('getAllFilesInPath', () => {
  // A temp directory, so a test run never writes into the repository tree.
  let testDir: string

  beforeAll(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'getAllFilesInPath-test-'))
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
    // Files must be returned sorted by full path so the files hash is
    // independent of filesystem traversal order
    const fileNames = files.map((f) => basename(f.fullpath()))
    expect(fileNames).toEqual(['apple.txt', 'banana.txt', 'zebra.txt'])
  })

  test('should return nested files sorted by full path', async () => {
    await mkdir(join(testDir, 'b'), { recursive: true })
    await mkdir(join(testDir, 'a'), { recursive: true })
    await writeFile(join(testDir, 'zebra.txt'), 'z content')
    await writeFile(join(testDir, 'b', 'file.txt'), 'b content')
    await writeFile(join(testDir, 'a', 'file.txt'), 'a content')

    const files = await getAllFilesInPath('*', testDir, [])

    const paths = files.map((f) => f.fullpath())
    expect(paths).toEqual([...paths].sort())
  })

  test('should handle no matching files', async () => {
    await writeFile(join(testDir, 'file.txt'), 'content')

    const files = await getAllFilesInPath('*.js', testDir, [])

    expect(files).toHaveLength(0)
  })

  test('should include dotfiles', async () => {
    // Create regular and dotfiles
    await writeFile(join(testDir, 'file.txt'), 'content')
    await writeFile(join(testDir, '.env'), 'SECRET=123')
    await writeFile(join(testDir, '.gitignore'), 'node_modules')

    const files = await getAllFilesInPath('*', testDir, [])

    expect(files).toHaveLength(3)
    expect(files.some((f) => f.fullpath().endsWith('file.txt'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('.env'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('.gitignore'))).toBe(true)
  })

  test('should include dotfiles in subdirectories', async () => {
    await mkdir(join(testDir, 'src'), { recursive: true })
    await writeFile(join(testDir, 'src', 'index.ts'), 'content')
    await writeFile(join(testDir, 'src', '.env.local'), 'SECRET=123')

    const files = await getAllFilesInPath('src', testDir, [])

    expect(files.some((f) => f.fullpath().endsWith('index.ts'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('.env.local'))).toBe(true)
  })

  test('should include dotdirectories and their contents', async () => {
    await mkdir(join(testDir, '.hidden'), { recursive: true })
    await writeFile(join(testDir, '.hidden', 'config.json'), '{}')
    await writeFile(join(testDir, 'visible.txt'), 'content')

    const files = await getAllFilesInPath('*', testDir, [])

    expect(files.some((f) => f.fullpath().endsWith('.hidden'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('config.json'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('visible.txt'))).toBe(true)
  })

  test('should respect ignore patterns for dotfiles', async () => {
    await writeFile(join(testDir, '.env'), 'SECRET=123')
    await writeFile(join(testDir, '.gitignore'), 'node_modules')
    await writeFile(join(testDir, 'file.txt'), 'content')

    const files = await getAllFilesInPath('*', testDir, ['.env'])

    expect(files).toHaveLength(2)
    expect(files.some((f) => f.fullpath().endsWith('.env'))).toBe(false)
    expect(files.some((f) => f.fullpath().endsWith('.gitignore'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('file.txt'))).toBe(true)
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

    // 3 files + 4 directories (src, components, utils and the emptied tests,
    // since `tests/**` matches the contents of `tests`, as in Docker)
    expect(files).toHaveLength(7)
    expect(files.some((f) => f.fullpath().endsWith('index.ts'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('Button.tsx'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('helper.ts'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('test.spec.ts'))).toBe(false)
  })

  describe('.dockerignore semantics', () => {
    const relativePaths = async (src: string, ignorePatterns: string[]) =>
      (await getAllFilesInPath(src, testDir, ignorePatterns))
        .map((f) => relative(testDir, f.fullpath()).replace(/\\/g, '/') || '.')
        .sort()

    beforeEach(async () => {
      await mkdir(join(testDir, 'node_modules', 'pkg'), { recursive: true })
      await mkdir(join(testDir, 'src', 'generated'), { recursive: true })
      await mkdir(join(testDir, 'src', 'node_modules'), { recursive: true })
      await mkdir(join(testDir, '.git'), { recursive: true })
      await writeFile(join(testDir, '.env'), 'SECRET=1')
      await writeFile(join(testDir, 'node_modules', 'pkg', 'index.js'), 'x')
      await writeFile(join(testDir, 'src', 'app.ts'), 'x')
      await writeFile(join(testDir, 'src', 'app.spec.ts'), 'x')
      await writeFile(join(testDir, 'src', 'generated', 'api.ts'), 'x')
      await writeFile(join(testDir, 'src', 'node_modules', 'lib.js'), 'x')
      await writeFile(join(testDir, '.git', 'HEAD'), 'ref')
    })

    const patterns = [
      '.env',
      'node_modules',
      '.git',
      '**/*.spec.*',
      'src/generated',
    ]

    test.each(['.', './', './src', 'src', 'src/.', 'src/../src'])(
      'should exclude ignored directories with their contents for %s',
      async (src) => {
        const files = await relativePaths(src, patterns)
        const expected = [
          'src',
          'src/app.ts',
          'src/node_modules',
          'src/node_modules/lib.js',
        ]
        const copiesRoot = src === '.' || src === './'
        expect(files).toEqual(copiesRoot ? ['.', ...expected] : expected)
      }
    )

    test('should ignore a leading slash and a trailing slash', async () => {
      const files = await relativePaths('.', [
        '/node_modules',
        '/.git/',
        'src/',
      ])
      expect(files).toEqual(['.', '.env'])
    })

    test('should never exclude the context root', async () => {
      const files = await relativePaths('.', ['.', '.*', 'src', 'node_modules'])
      expect(files).toEqual(['.'])
    })

    test('should not copy paths inside an ignored directory', async () => {
      const files = await relativePaths('node_modules/pkg', ['node_modules'])
      expect(files).toEqual([])
    })

    test('should re-include paths matched by a negated pattern', async () => {
      const files = await relativePaths('.', [
        '*',
        '!src',
        'src/generated',
        '!node_modules/pkg/index.js',
      ])
      expect(files).toEqual([
        '.',
        'node_modules/pkg/index.js',
        'src',
        'src/app.spec.ts',
        'src/app.ts',
        'src/node_modules',
        'src/node_modules/lib.js',
      ])
    })

    test('should make absolute patterns inside the context relative', async () => {
      const files = await relativePaths('.', [
        join(testDir, 'src'),
        join(testDir, 'node_modules', '**'),
        '.git',
      ])
      expect(files).toEqual(['.', '.env', 'node_modules'])
    })

    test('should match regex special characters literally', async () => {
      await writeFile(join(testDir, 'file (1).txt'), 'x')
      await writeFile(join(testDir, 'c++'), 'x')
      await writeFile(join(testDir, 'a'), 'x')
      const files = await relativePaths('*', ['file (1).txt', 'c++', 'a|b'])
      expect(files).not.toContain('file (1).txt')
      expect(files).not.toContain('c++')
      expect(files).toContain('a')
    })

    test('should throw on an invalid pattern', async () => {
      await expect(getAllFilesInPath('.', testDir, ['[abc'])).rejects.toThrow(
        "Invalid ignore pattern '[abc'"
      )
    })

    test('should keep the files hash stable when ignored files change', async () => {
      const hash = () =>
        calculateFilesHash('.', '/app', testDir, ['.git'], false, undefined)
      const before = await hash()
      await appendFile(join(testDir, '.git', 'HEAD'), 'x')
      expect(await hash()).toBe(before)
    })

    test('should match a caret literally outside a bracket expression', async () => {
      for (const name of ['report^draft.txt', 'ax', 'bx']) {
        await writeFile(join(testDir, name), 'x')
      }
      const files = await relativePaths('*', ['report^draft.txt', '[^a]x'])
      expect(files).not.toContain('report^draft.txt')
      expect(files).not.toContain('bx')
      expect(files).toContain('ax')
    })

    test('should not walk the recursive matches of a directory again', async () => {
      const files = await relativePaths('**/*', patterns)
      expect(files).toEqual([
        'src',
        'src/app.ts',
        'src/node_modules',
        'src/node_modules/lib.js',
      ])
    })

    test.skipIf(process.platform === 'win32')(
      'should copy a symlink to a directory without its contents',
      async () => {
        await mkdir(join(testDir, 'real'))
        await writeFile(join(testDir, 'real', 'secret.txt'), 'x')
        await symlink('real', join(testDir, 'linked'))
        expect(await relativePaths('linked', [])).toEqual(['linked'])
      }
    )

    test('should keep the files hash stable when ignored files grow a directory', async () => {
      const hash = () =>
        calculateFilesHash(
          '.',
          '/app',
          testDir,
          ['node_modules/*'],
          false,
          undefined
        )
      const before = await hash()
      for (let i = 0; i < 300; i++) {
        await writeFile(
          join(testDir, 'node_modules', `ignored-file-with-a-long-name-${i}`),
          'x'
        )
      }
      expect(await hash()).toBe(before)
    })

    test('should strip a UTF-8 BOM from .dockerignore', async () => {
      await writeFile(
        join(testDir, '.dockerignore'),
        '\uFEFF.env\n# comment\n\nsrc\n'
      )
      expect(readDockerignore(testDir)).toEqual(['.env', 'src'])
    })
  })
})
