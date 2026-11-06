import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import * as fs from 'fs/promises'
import * as os from 'os'
import * as path from 'path'
import { execSync } from 'child_process'
import { Language } from '../../../src/commands/template/generators'

interface FileNames {
  template: string
  buildDev: string
  buildProd: string
}

function getFileNames(language: Language): FileNames {
  switch (language) {
    case Language.TypeScript: {
      return {
        template: 'template.ts',
        buildDev: 'build.dev.ts',
        buildProd: 'build.prod.ts',
      }
    }
    case Language.PythonSync:
    case Language.PythonAsync: {
      return {
        template: 'template.py',
        buildDev: 'build_dev.py',
        buildProd: 'build_prod.py',
      }
    }
    default:
      throw new Error(`Unsupported language: ${language}`)
  }
}

describe('Template Migration', () => {
  let testDir: string
  const cliPath = path.join(process.cwd(), 'dist', 'index.js')
  const fixturesDir = path.join(__dirname, 'fixtures')

  beforeEach(async () => {
    // Use Node.js built-in temp directory handling
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'e2b-migrate-test-'))
  })

  afterEach(async () => {
    // Clean up test directory
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true })
    }
  })

  // Run tests for each test case
  describe('Migration Test Cases', () => {
    // Test case names correspond to fixture directory names
    const testCases: Record<string, string> = {
      'complex-python': '--name complex-python-app',
      'copy-variations': '--name copy-test',
      'custom-commands':
        '--name custom-app --cmd "node server.js" --ready-cmd "curl -f http://localhost:3000/health || exit 1"',
      'minimal-dockerfile': '--name minimal-template',
      'multiple-env': '--name env-test',
      'start-cmd':
        '--name start-cmd --cpu-count 2 --memory-mb 1024 --cmd "node server.js"',
      'multi-stage': '--name multi-stage',
    }

    Object.keys(testCases).forEach((testCaseName) => {
      describe(testCaseName.replace('-', ' '), () => {
        test('should migrate to TypeScript', async () => {
          await runMigrationTest(testCaseName, Language.TypeScript)
        })

        test('should migrate to Python sync', async () => {
          await runMigrationTest(testCaseName, Language.PythonSync)
        })

        test('should migrate to Python async', async () => {
          await runMigrationTest(testCaseName, Language.PythonAsync)
        })
      })
    })

    async function runMigrationTest(testCaseName: string, language: Language) {
      const fixtureDir = path.join(fixturesDir, testCaseName)

      await fs.copyFile(
        path.join(fixtureDir, 'e2b.Dockerfile'),
        path.join(testDir, 'e2b.Dockerfile')
      )

      execSync(
        `node ${cliPath} template migrate --language ${language} ${testCases[testCaseName]}`,
        {
          cwd: testDir,
        }
      )

      // Determine file extensions and names based on language
      const fileNames = getFileNames(language)

      // Load expected outputs
      const expectedDir = path.join(fixtureDir, 'expected', language)
      const expectedTemplate = await fs.readFile(
        path.join(expectedDir, fileNames.template),
        'utf-8'
      )
      const expectedBuildDev = await fs.readFile(
        path.join(expectedDir, fileNames.buildDev),
        'utf-8'
      )
      const expectedBuildProd = await fs.readFile(
        path.join(expectedDir, fileNames.buildProd),
        'utf-8'
      )

      // Check generated files
      const templateFile = await fs.readFile(
        path.join(testDir, fileNames.template),
        'utf-8'
      )
      expect(templateFile.trim()).toEqual(expectedTemplate.trim())

      const buildDevFile = await fs.readFile(
        path.join(testDir, fileNames.buildDev),
        'utf-8'
      )
      expect(buildDevFile.trim()).toEqual(expectedBuildDev.trim())

      const buildProdFile = await fs.readFile(
        path.join(testDir, fileNames.buildProd),
        'utf-8'
      )
      expect(buildProdFile.trim()).toEqual(expectedBuildProd.trim())
      if (
        language === Language.PythonSync ||
        language === Language.PythonAsync
      ) {
        for (const content of [buildDevFile, buildProdFile]) {
          expect(content).toContain('from template import template')
          expect(content).not.toContain('from .template import template')
        }
      }

      // Check that the Dockerfile is renamed to .old
      expect(
        await fs
          .access(path.join(testDir, 'e2b.Dockerfile.old'))
          .then(() => true)
          .catch(() => false)
      ).toBe(true)
      expect(
        await fs
          .access(path.join(testDir, 'e2b.Dockerfile'))
          .then(() => true)
          .catch(() => false)
      ).toBe(false)
    }
  })

  describe('Override Options', () => {
    test('should apply name, command and resource options', async () => {
      const dockerfile = 'FROM node:18'
      await fs.writeFile(path.join(testDir, 'e2b.Dockerfile'), dockerfile)

      execSync(
        `node ${cliPath} template migrate --language typescript --name "  Overridden-Name  " --cmd "node server.js" --ready-cmd "curl localhost:3000" --cpu-count 4 --memory-mb 2048`,
        {
          cwd: testDir,
        }
      )

      const templateFile = await fs.readFile(
        path.join(testDir, 'template.ts'),
        'utf-8'
      )
      expect(templateFile).toContain(
        ".setStartCmd('sudo node server.js', 'curl localhost:3000')"
      )

      const buildProdFile = await fs.readFile(
        path.join(testDir, 'build.prod.ts'),
        'utf-8'
      )
      expect(buildProdFile).toContain("'overridden-name'")
      expect(buildProdFile).toContain('cpuCount: 4')
      expect(buildProdFile).toContain('memoryMB: 2048')
    })

    test('should reject an invalid --name', async () => {
      const dockerfile = 'FROM node:18'
      await fs.writeFile(path.join(testDir, 'e2b.Dockerfile'), dockerfile)

      expect(() => {
        execSync(
          `node ${cliPath} template migrate --language typescript --name "Invalid Name"`,
          {
            cwd: testDir,
          }
        )
      }).toThrow()
    })

    test('should reject non-numeric resource overrides', async () => {
      const dockerfile = 'FROM node:18'
      await fs.writeFile(path.join(testDir, 'e2b.Dockerfile'), dockerfile)

      expect(() => {
        execSync(
          `node ${cliPath} template migrate --language typescript --cpu-count abc`,
          {
            cwd: testDir,
          }
        )
      }).toThrow()

      expect(() => {
        execSync(
          `node ${cliPath} template migrate --language typescript --memory-mb abc`,
          {
            cwd: testDir,
          }
        )
      }).toThrow()
    })

    test('should reject an odd memory override', async () => {
      const dockerfile = 'FROM node:18'
      await fs.writeFile(path.join(testDir, 'e2b.Dockerfile'), dockerfile)

      expect(() => {
        execSync(
          `node ${cliPath} template migrate --language typescript --memory-mb 1023`,
          {
            cwd: testDir,
          }
        )
      }).toThrow()
    })
  })

  describe('Error Cases', () => {
    test('should ignore e2b.toml and warn on deprecated --config and --path', async () => {
      await fs.writeFile(path.join(testDir, 'e2b.Dockerfile'), 'FROM node:18')
      await fs.writeFile(
        path.join(testDir, 'e2b.toml'),
        'template_id = "config-name"\ndockerfile = "e2b.Dockerfile"\nstart_cmd = "node server.js"'
      )

      const output = execSync(
        `node ${cliPath} template migrate --language typescript --config e2b.toml --path . 2>&1`,
        {
          cwd: testDir,
          encoding: 'utf-8',
        }
      )

      expect(output).toContain('The --config flag is deprecated and ignored')
      expect(output).toContain('The --path flag is deprecated')
      expect(output).toContain('Migration completed successfully')

      const buildProdFile = await fs.readFile(
        path.join(testDir, 'build.prod.ts'),
        'utf-8'
      )
      expect(buildProdFile).toContain("'name-your-template'")
      expect(buildProdFile).not.toContain("'config-name'")
      const templateFile = await fs.readFile(
        path.join(testDir, 'template.ts'),
        'utf-8'
      )
      expect(templateFile).not.toContain('setStartCmd')

      const files = await fs.readdir(testDir)
      expect(files).toContain('e2b.toml')
      expect(files).not.toContain('e2b.toml.old')
    })

    test('should fail gracefully when Dockerfile is missing', async () => {
      // Run migration and expect it to fail
      expect(() => {
        execSync(`node ${cliPath} template migrate --language typescript`, {
          cwd: testDir,
        })
      }).toThrow()
    })
  })

  describe('File Collision Handling', () => {
    test('should error out if files already exist', async () => {
      // Create test Dockerfile
      const dockerfile = 'FROM node:18'
      await fs.writeFile(path.join(testDir, 'e2b.Dockerfile'), dockerfile)

      // Create existing files
      await fs.writeFile(path.join(testDir, 'template.ts'), '// existing')
      await fs.writeFile(path.join(testDir, 'build.dev.ts'), '// existing')
      await fs.writeFile(path.join(testDir, 'build.prod.ts'), '// existing')

      // Run migration
      expect(() => {
        execSync(`node ${cliPath} template migrate --language typescript`, {
          cwd: testDir,
        })
      }).toThrow()

      const files = await fs.readdir(testDir)
      expect(files).toContain('template.ts')
      expect(files).toContain('build.dev.ts')
      expect(files).toContain('build.prod.ts')
    })
  })
})
