import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import * as fs from 'fs/promises'
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
    testDir = await fs.mkdtemp('e2b-migrate-test-')
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
    const testCases = [
      'complex-python',
      'copy-variations',
      'custom-commands',
      'minimal-dockerfile',
      'multiple-env',
      'start-cmd',
      'multi-stage',
    ]

    testCases.forEach((testCaseName) => {
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

      // Copy fixture files to test directory
      await copyFixtureFiles(fixtureDir, testDir)

      // Run migration
      execSync(`node ${cliPath} template migrate --language ${language}`, {
        cwd: testDir,
      })

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

      // Check that old files are renamed to .old extensions
      const oldDockerfilePath = path.join(testDir, 'e2b.Dockerfile.old')
      const oldConfigPath = path.join(testDir, 'e2b.toml.old')

      expect(
        await fs
          .access(oldDockerfilePath)
          .then(() => true)
          .catch(() => false)
      ).toBe(true)
      expect(
        await fs
          .access(oldConfigPath)
          .then(() => true)
          .catch(() => false)
      ).toBe(true)

      // Verify original files no longer exist
      const originalDockerfilePath = path.join(testDir, 'e2b.Dockerfile')
      const originalConfigPath = path.join(testDir, 'e2b.toml')

      expect(
        await fs
          .access(originalDockerfilePath)
          .then(() => true)
          .catch(() => false)
      ).toBe(false)
      expect(
        await fs
          .access(originalConfigPath)
          .then(() => true)
          .catch(() => false)
      ).toBe(false)
    }

    async function copyFixtureFiles(fixtureDir: string, targetDir: string) {
      // Copy Dockerfile and config
      await fs.copyFile(
        path.join(fixtureDir, 'e2b.Dockerfile'),
        path.join(targetDir, 'e2b.Dockerfile')
      )
      await fs.copyFile(
        path.join(fixtureDir, 'e2b.toml'),
        path.join(targetDir, 'e2b.toml')
      )
    }
  })

  describe('Error Cases', () => {
    test('should succeed with warning when config file is missing', async () => {
      // Create only Dockerfile, no config
      const dockerfile = 'FROM node:18'
      await fs.writeFile(path.join(testDir, 'e2b.Dockerfile'), dockerfile)

      // Run migration and expect it to succeed with warning (capture stderr + stdout)
      const output = execSync(
        `node ${cliPath} template migrate --language typescript 2>&1`,
        {
          cwd: testDir,
          encoding: 'utf-8',
        }
      )

      expect(output).toContain(
        'Config file ./e2b.toml not found. Using defaults.'
      )
      expect(output).toContain('Migration completed successfully')
    })

    test('should fail gracefully when Dockerfile is missing', async () => {
      // Create only config, no Dockerfile
      const config = `template_id = "test-app"
dockerfile = "e2b.Dockerfile"`
      await fs.writeFile(path.join(testDir, 'e2b.toml'), config)

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

      // Create test config
      const config = `template_id = "test-app"
dockerfile = "e2b.Dockerfile"`
      await fs.writeFile(path.join(testDir, 'e2b.toml'), config)

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
