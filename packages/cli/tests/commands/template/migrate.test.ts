import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import { execSync } from 'child_process'

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
    ]

    testCases.forEach((testCaseName) => {
      describe(testCaseName.replace('-', ' '), () => {
        test('should migrate to TypeScript', async () => {
          await runMigrationTest(testCaseName, 'typescript')
        })

        test('should migrate to Python sync', async () => {
          await runMigrationTest(testCaseName, 'python-sync')
        })

        test('should migrate to Python async', async () => {
          await runMigrationTest(testCaseName, 'python-async')
        })
      })
    })

    async function runMigrationTest(testCaseName: string, language: string) {
      const fixtureDir = path.join(fixturesDir, testCaseName)

      // Copy fixture files to test directory
      await copyFixtureFiles(fixtureDir, testDir)

      // Run migration
      execSync(`node ${cliPath} template migrate --language ${language}`, {
        cwd: testDir,
      })

      // Determine file extensions and names based on language
      const isTypescript = language === 'typescript'
      const templateExt = isTypescript ? '.ts' : '.py'
      const buildDevName = isTypescript ? 'build.dev.ts' : 'build_dev.py'
      const buildProdName = isTypescript ? 'build.prod.ts' : 'build_prod.py'

      // Load expected outputs
      const expectedDir = path.join(fixtureDir, 'expected', language)
      const expectedTemplate = await fs.readFile(
        path.join(expectedDir, `template${templateExt}`),
        'utf-8'
      )
      const expectedBuildDev = await fs.readFile(
        path.join(expectedDir, buildDevName),
        'utf-8'
      )
      const expectedBuildProd = await fs.readFile(
        path.join(expectedDir, buildProdName),
        'utf-8'
      )

      // Check generated files
      const templateFile = await fs.readFile(
        path.join(testDir, `template${templateExt}`),
        'utf-8'
      )
      expect(templateFile.trim()).toEqual(expectedTemplate.trim())

      const buildDevFile = await fs.readFile(
        path.join(testDir, buildDevName),
        'utf-8'
      )
      expect(buildDevFile.trim()).toEqual(expectedBuildDev.trim())

      const buildProdFile = await fs.readFile(
        path.join(testDir, buildProdName),
        'utf-8'
      )
      expect(buildProdFile.trim()).toEqual(expectedBuildProd.trim())
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
    test('should fail gracefully when config file is missing', async () => {
      // Create only Dockerfile, no config
      const dockerfile = 'FROM node:18'
      await fs.writeFile(path.join(testDir, 'e2b.Dockerfile'), dockerfile)

      // Run migration and expect it to fail
      expect(() => {
        execSync(`node ${cliPath} template migrate --language typescript`, {
          cwd: testDir,
        })
      }).toThrow()
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

    test('should reject multi-stage Dockerfiles', async () => {
      const dockerfileContent = `FROM node:18 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:18-slim
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "index.js"]`

      await fs.writeFile(
        path.join(testDir, 'e2b.Dockerfile'),
        dockerfileContent
      )

      const config = `template_id = "multi-stage"
dockerfile = "e2b.Dockerfile"`
      await fs.writeFile(path.join(testDir, 'e2b.toml'), config)

      // Should fail for all languages
      const languages = ['typescript', 'python-sync', 'python-async']
      for (const language of languages) {
        expect(() => {
          execSync(`node ${cliPath} template migrate --language ${language}`, {
            cwd: testDir,
            stdio: 'pipe',
          })
        }).toThrow()
      }
    })
  })

  describe('File Collision Handling', () => {
    test('should generate unique filenames if files already exist', async () => {
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
      execSync(`node ${cliPath} template migrate --language typescript`, {
        cwd: testDir,
      })

      // Check that new files were created with different names
      const files = await fs.readdir(testDir)
      expect(files).toContain('template.ts') // original
      expect(files).toContain('template-1.ts') // new
      expect(files).toContain('build.dev.ts') // original
      expect(files).toContain('build.dev-1.ts') // new
      expect(files).toContain('build.prod.ts') // original
      expect(files).toContain('build.prod-1.ts') // new
    })
  })
})
