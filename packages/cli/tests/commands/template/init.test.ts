import { execSync } from 'child_process'
import { existsSync } from 'fs'
import * as fs from 'fs/promises'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { Language } from '../../../src/commands/template/generators'

describe('Template Init', () => {
  let testDir: string
  const cliPath = path.join(process.cwd(), 'dist', 'index.js')

  beforeEach(async () => {
    // Use Node.js built-in temp directory handling
    testDir = await fs.mkdtemp('e2b-init-test-')
  })

  afterEach(async () => {
    // Clean up test directory
    if (testDir) {
      await fs.rm(testDir, { recursive: true, force: true })
    }
  })

  describe('CLI Options', () => {
    Object.values(Language).forEach((language) => {
      test(`should generate files with --name and --language ${language}`, async () => {
        const templateName = 'my-test-template'

        // Run init command with CLI options
        execSync(
          `node "${cliPath}" template init --name "${templateName}" --language "${language}" --path "${testDir}"`,
          { stdio: 'inherit' }
        )

        // Verify template directory was created
        const templateDir = path.join(testDir, templateName)
        expect(existsSync(templateDir)).toBe(true)

        // Verify files were created in the template directory
        const expectedFiles = getExpectedFiles(language)

        for (const file of expectedFiles) {
          const filePath = path.join(templateDir, file)
          expect(existsSync(filePath)).toBe(true)

          // Verify file content is not empty
          const content = await fs.readFile(filePath, 'utf8')
          expect(content.trim().length).toBeGreaterThan(0)
        }

        // Verify template name is used in build files
        await verifyTemplateNameInBuildFiles(
          templateDir,
          language,
          templateName
        )
      })
    })

    test('should validate template name format', async () => {
      const invalidNames = [
        'My-Template', // uppercase
        '-invalid-start', // starts with hyphen
        'invalid-end-', // ends with hyphen
        '_invalid-start', // starts with underscore
        'invalid-end_', // ends with underscore
        'invalid space', // contains space
        '', // empty
      ]

      for (const invalidName of invalidNames) {
        expect(() => {
          execSync(
            `node "${cliPath}" template init --name "${invalidName}" --language "typescript" --path "${testDir}"`,
            { stdio: 'pipe' }
          )
        }).toThrow()
      }
    })

    test('should validate language parameter', async () => {
      expect(() => {
        execSync(
          `node "${cliPath}" template init --name "test" --language "invalid-lang" --path "${testDir}"`,
          { stdio: 'pipe' }
        )
      }).toThrow()
    })

    test('should work with valid template names', async () => {
      const validNames = [
        'a', // single character
        'abc', // simple
        'my-template', // with hyphens
        'my_template', // with underscores
        'my-template_name', // with hyphens and underscores
        'test123', // with numbers
        '123test', // starting with number
        'a-b-c-d-e', // multiple hyphens
        'a_b_c_d_e', // multiple underscores
        'api-server_v2', // mixed hyphens and underscores
      ]

      for (const validName of validNames) {
        // Clean directory before each test
        const files = await fs.readdir(testDir)
        for (const file of files) {
          await fs.rm(path.join(testDir, file), {
            recursive: true,
            force: true,
          })
        }

        // Should not throw
        execSync(
          `node "${cliPath}" template init --name "${validName}" --language "typescript" --path "${testDir}"`,
          { stdio: 'pipe' }
        )

        // Verify template directory was created
        const templateDir = path.join(testDir, validName)
        expect(existsSync(templateDir)).toBe(true)

        // Verify files were created in the template directory
        const expectedFiles = getExpectedFiles(Language.TypeScript)
        for (const file of expectedFiles) {
          expect(existsSync(path.join(templateDir, file))).toBe(true)
        }
      }
    })
  })

  describe('Package.json Integration', () => {
    test('should add scripts to existing package.json', async () => {
      // Create a package.json file in the parent directory
      const packageJson = {
        name: 'test-project',
        version: '1.0.0',
        scripts: {
          test: 'echo "test"',
        },
      }
      const packageJsonPath = path.join(testDir, 'package.json')
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2))

      // Run init command
      execSync(
        `node "${cliPath}" template init --name "test-template" --language "typescript" --path "${testDir}"`,
        { stdio: 'inherit' }
      )

      // Verify package.json was updated (it should remain in the parent directory)
      const updatedPackageJson = JSON.parse(
        await fs.readFile(packageJsonPath, 'utf8')
      )

      expect(updatedPackageJson.scripts).toHaveProperty('e2b:build:dev')
      expect(updatedPackageJson.scripts).toHaveProperty('e2b:build:prod')
      expect(updatedPackageJson.scripts.test).toBe('echo "test"') // existing script preserved
    })

    test('should work without package.json', async () => {
      // Run init command without package.json
      execSync(
        `node "${cliPath}" template init --name "test-template" --language "typescript" --path "${testDir}"`,
        { stdio: 'inherit' }
      )

      // Verify template directory was created
      const templateDir = path.join(testDir, 'test-template')
      expect(existsSync(templateDir)).toBe(true)

      // Verify files were created in the template directory
      const expectedFiles = getExpectedFiles(Language.TypeScript)
      for (const file of expectedFiles) {
        expect(existsSync(path.join(templateDir, file))).toBe(true)
      }

      // Verify package.json was created in the template directory
      const createdPackageJSON = JSON.parse(
        await fs.readFile(path.join(templateDir, 'package.json'), 'utf8')
      )

      expect(createdPackageJSON.scripts).toHaveProperty('e2b:build:dev')
      expect(createdPackageJSON.scripts).toHaveProperty('e2b:build:prod')
    })
  })

  describe('Makefile Integration', () => {
    test('should add scripts to existing Makefile', async () => {
      // Create a Makefile file in the parent directory
      const makefile = `
.PHONY: build
build/%:
\tCGO_ENABLED=1 go build
      `
      const makefilePath = path.join(testDir, 'Makefile')
      await fs.writeFile(makefilePath, makefile)

      // Run init command
      execSync(
        `node "${cliPath}" template init --name "test-template" --language "python-sync" --path "${testDir}"`,
        { stdio: 'inherit' }
      )

      // Verify Makefile was updated (it should remain in the parent directory)
      const updatedMakefile = await fs.readFile(makefilePath, 'utf8')

      expect(updatedMakefile).toContain('e2b:build:dev')
      expect(updatedMakefile).toContain('e2b:build:prod')
      expect(updatedMakefile).toContain(`.PHONY: build
build/%:
\tCGO_ENABLED=1 go build`) // existing script preserved
    })

    test('should work without Makefile', async () => {
      // Run init command without Makefile
      execSync(
        `node "${cliPath}" template init --name "test-template" --language "python-sync" --path "${testDir}"`,
        { stdio: 'inherit' }
      )

      // Verify template directory was created
      const templateDir = path.join(testDir, 'test-template')
      expect(existsSync(templateDir)).toBe(true)

      // Verify files were created in the template directory
      const expectedFiles = getExpectedFiles(Language.PythonSync)
      for (const file of expectedFiles) {
        expect(existsSync(path.join(templateDir, file))).toBe(true)
      }

      // Verify Makefile was created in the template directory
      const createdMakefile = await fs.readFile(
        path.join(templateDir, 'Makefile'),
        'utf8'
      )
      expect(createdMakefile).toContain('e2b:build:dev')
      expect(createdMakefile).toContain('e2b:build:prod')
    })
  })

  describe('File Content Validation', () => {
    test('should generate correct TypeScript template content', async () => {
      execSync(
        `node "${cliPath}" template init --name "test-ts" --language "typescript" --path "${testDir}"`,
        { stdio: 'inherit' }
      )

      const templateDir = path.join(testDir, 'test-ts')
      const templateContent = await fs.readFile(
        path.join(templateDir, 'template.ts'),
        'utf8'
      )

      // Verify basic structure
      expect(templateContent).toContain("import { Template } from 'e2b'")
      expect(templateContent).toContain('export const template = Template()')
      expect(templateContent).toContain('fromImage')
      expect(templateContent).toContain('e2bdev/base')
    })

    test('should generate correct Python template content', async () => {
      execSync(
        `node "${cliPath}" template init --name "test-py" --language "python-sync" --path "${testDir}"`,
        { stdio: 'inherit' }
      )

      const templateDir = path.join(testDir, 'test-py')
      const templateContent = await fs.readFile(
        path.join(templateDir, 'template.py'),
        'utf8'
      )

      // Verify basic structure
      expect(templateContent).toContain('from e2b import Template')
      expect(templateContent).toContain('template = (')
      expect(templateContent).toContain('Template()')
      expect(templateContent).toContain('from_image')
      expect(templateContent).toContain('e2bdev/base')
    })

    test('should generate correct async Python template content', async () => {
      execSync(
        `node "${cliPath}" template init --name "test-py-async" --language "python-async" --path "${testDir}"`,
        { stdio: 'inherit' }
      )

      const templateContent = await fs.readFile(
        path.join(testDir, 'test-py-async', 'template.py'),
        'utf8'
      )

      // Verify async structure
      expect(templateContent).toContain('from e2b import AsyncTemplate')
      expect(templateContent).toContain('AsyncTemplate()')
    })
  })

  describe('Directory Conflict Handling', () => {
    test('should fail when directory already exists', async () => {
      // Create a directory that would conflict
      const conflictDir = path.join(testDir, 'test')
      await fs.mkdir(conflictDir)
      await fs.writeFile(
        path.join(conflictDir, 'existing.txt'),
        'existing content'
      )

      // Should fail when trying to create template with existing directory name
      expect(() => {
        execSync(
          `node "${cliPath}" template init --name "test" --language "typescript" --path "${testDir}"`,
          { stdio: 'pipe' }
        )
      }).toThrow()

      // Verify original directory is preserved and unchanged
      expect(existsSync(path.join(conflictDir, 'existing.txt'))).toBe(true)

      // Verify no template files were created in the existing directory
      expect(existsSync(path.join(conflictDir, 'template.ts'))).toBe(false)
    })
  })
})

// Helper functions
function getExpectedFiles(language: Language): string[] {
  const extension = language === Language.TypeScript ? '.ts' : '.py'
  const buildDevName =
    language === Language.TypeScript ? 'build.dev' : 'build_dev'
  const buildProdName =
    language === Language.TypeScript ? 'build.prod' : 'build_prod'

  return [
    `template${extension}`,
    `${buildDevName}${extension}`,
    `${buildProdName}${extension}`,
  ]
}

async function verifyTemplateNameInBuildFiles(
  testDir: string,
  language: Language,
  templateName: string
): Promise<void> {
  const extension = language === Language.TypeScript ? '.ts' : '.py'
  const buildDevName =
    language === Language.TypeScript ? 'build.dev' : 'build_dev'
  const buildProdName =
    language === Language.TypeScript ? 'build.prod' : 'build_prod'

  // Check dev build file contains template name with -dev suffix
  const devContent = await fs.readFile(
    path.join(testDir, `${buildDevName}${extension}`),
    'utf8'
  )
  expect(devContent).toContain(`${templateName}-dev`)

  // Check prod build file contains template name
  const prodContent = await fs.readFile(
    path.join(testDir, `${buildProdName}${extension}`),
    'utf8'
  )
  expect(prodContent).toContain(templateName)
  expect(prodContent).not.toContain(`${templateName}-dev`) // should not have -dev suffix
}
