import { expect, test, describe, beforeAll, afterAll, beforeEach } from 'vitest'
import { appendFile, writeFile, mkdir, mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join, basename } from 'path'
import { Template } from '../../../src'
import {
  calculateFilesHash,
  getAllFilesInPath,
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

    expect(files).toHaveLength(6) // 3 files + 3 directories (src, components, utils)
    expect(files.some((f) => f.fullpath().endsWith('index.ts'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('Button.tsx'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('helper.ts'))).toBe(true)
    expect(files.some((f) => f.fullpath().endsWith('test.spec.ts'))).toBe(false)
  })

  test('should include files in directories with glob characters in their names', async () => {
    await mkdir(join(testDir, 'app', '[id]'), { recursive: true })
    await writeFile(join(testDir, 'app', '[id]', 'page.tsx'), 'page')

    const files = await getAllFilesInPath('app/*', testDir, [])

    expect(files.map((f) => f.relativePosix()).sort()).toEqual([
      'app/[id]',
      'app/[id]/page.tsx',
    ])
  })
})

// Ignore patterns follow Docker's .dockerignore rules: each pattern is matched
// against a path and its parent directories, the last matching pattern wins.
describe('getAllFilesInPath dockerignore semantics', () => {
  let ctx: string

  const rel = async (src: string, ignore: string[]) =>
    (await getAllFilesInPath(src, ctx, ignore))
      .map((f) => f.relativePosix() || '.')
      .sort()

  beforeAll(async () => {
    ctx = await mkdtemp(join(tmpdir(), 'getAllFilesInPath-ignore-test-'))
    for (const dir of [
      'node_modules/pkg',
      'src/generated',
      'src/node_modules',
      '.git',
      'dist',
    ]) {
      await mkdir(join(ctx, dir), { recursive: true })
    }
    for (const file of [
      '.env',
      'node_modules/pkg/index.js',
      'src/app.ts',
      'src/app.spec.ts',
      'src/generated/api.ts',
      'src/node_modules/x.js',
      '.git/HEAD',
    ]) {
      await writeFile(join(ctx, file), 'x')
    }
  })

  afterAll(async () => {
    await rm(ctx, { recursive: true, force: true })
  })

  const ignore = [
    '.env',
    'node_modules',
    '.git',
    '**/*.spec.*',
    'src/generated',
  ]
  const srcFiles = [
    'src',
    'src/app.ts',
    'src/node_modules',
    'src/node_modules/x.js',
  ]

  test.each(['.', './'])(
    'applies patterns and excludes directory contents for %j',
    async (src) => {
      expect(await rel(src, ignore)).toEqual(['.', 'dist', ...srcFiles])
    }
  )

  test.each(['./src', 'src/.', 'dist/../src', 'src'])(
    'applies patterns regardless of how src is written: %j',
    async (src) => {
      expect(await rel(src, ignore)).toEqual(srcFiles)
    }
  )

  test('trailing slash and ** directory patterns exclude contents', async () => {
    expect(
      await rel('.', ['node_modules/', '**/node_modules', '.*', 'src/*'])
    ).toEqual(['.', 'dist', 'src'])
  })

  test('leading slash is root-relative', async () => {
    expect(
      await rel('.', ['/node_modules', '/src/generated/**', '/.git', '/.env'])
    ).toEqual([
      '.',
      'dist',
      'src',
      'src/app.spec.ts',
      'src/app.ts',
      'src/node_modules',
      'src/node_modules/x.js',
    ])
  })

  test('. pattern is ignored and never drops the root', async () => {
    const all = await rel('.', [])
    expect(await rel('.', ['.', './', ''])).toEqual(all)
    expect(await rel('.', ['.*', '*'])).toEqual(['.'])
  })

  test('copying a path inside an ignored directory finds nothing', async () => {
    expect(await rel('node_modules/pkg', ['node_modules'])).toEqual([])
  })

  test('! re-includes paths, last matching pattern wins', async () => {
    expect(await rel('.', ['*', ' !src ', 'src/generated'])).toEqual(
      ['.', 'src/app.spec.ts', ...srcFiles].sort()
    )
    expect(
      await rel('.', [
        'node_modules',
        '!node_modules/pkg/index.js',
        '*',
        '!node_modules',
      ])
    ).toEqual([
      '.',
      'node_modules',
      'node_modules/pkg',
      'node_modules/pkg/index.js',
    ])
  })

  test('! keeps the excluded parent directories of re-included paths', async () => {
    const reincluded = ['node_modules/pkg', 'node_modules/pkg/index.js']
    expect(
      await rel('node_modules', ['node_modules', '!node_modules/pkg/index.js'])
    ).toEqual(['node_modules', ...reincluded])
    expect(await rel('.', ['*', '!node_modules/pkg/index.js'])).toEqual([
      '.',
      'node_modules',
      ...reincluded,
    ])
  })

  test('wildcard ! patterns re-include paths inside excluded directories', async () => {
    expect(await rel('.', ['*', '!src/**/*.ts'])).toEqual([
      '.',
      'src',
      'src/app.spec.ts',
      'src/app.ts',
      'src/generated',
      'src/generated/api.ts',
    ])
    expect(await rel('.', ['*', '!**/index.js'])).toEqual([
      '.',
      'node_modules',
      'node_modules/pkg',
      'node_modules/pkg/index.js',
    ])
  })

  test.runIf(process.platform === 'darwin' || process.platform === 'win32')(
    'matches case-insensitively on macOS and Windows',
    async () => {
      expect(await rel('src', ['SRC/GENERATED', 'src/APP.*'])).toEqual([
        'src',
        'src/node_modules',
        'src/node_modules/x.js',
      ])
    }
  )

  test('files hash error for an ignored source mentions ignore patterns', async () => {
    await expect(
      calculateFilesHash(
        'node_modules/pkg',
        '/app',
        ctx,
        ['node_modules'],
        false,
        undefined
      )
    ).rejects.toThrow(/excluded by \.dockerignore or fileIgnorePatterns/)
  })

  test('files hash ignores changes to ignored directory contents', async () => {
    const hash = () =>
      calculateFilesHash('.', '/app', ctx, ['.git'], false, undefined)
    const before = await hash()
    await appendFile(join(ctx, '.git', 'HEAD'), 'x')
    expect(await hash()).toBe(before)
  })
})

describe('Template ignore patterns', () => {
  test('fileIgnorePatterns take precedence over .dockerignore and may be absolute', async () => {
    const ctx = await mkdtemp(join(tmpdir(), 'template-ignore-test-'))
    try {
      await writeFile(join(ctx, 'app.ts'), 'x')
      await writeFile(join(ctx, 'secret.txt'), 'x')
      await writeFile(join(ctx, '.dockerignore'), '!secret.txt\n')
      const filesHash = async () => {
        const template = Template({
          fileContextPath: ctx,
          fileIgnorePatterns: [join(ctx, 'secret.txt')],
        })
          .fromImage('node:22')
          .copy('.', '/app')
        return JSON.parse(await Template.toJSON(template)).steps[0].filesHash
      }

      const before = await filesHash()
      await appendFile(join(ctx, 'secret.txt'), 'x')
      expect(await filesHash()).toBe(before)
    } finally {
      await rm(ctx, { recursive: true, force: true })
    }
  })
})
