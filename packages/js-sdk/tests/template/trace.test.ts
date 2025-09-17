import { assert, test } from 'vitest'
import { BuildError, Template, TemplateClass, waitForTimeout } from '../../src'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'

const __fileContent = fs.readFileSync(__filename, 'utf8') // read current file content
const testTimeout = 180000 // 3 minutes
const nonExistentPath = '/nonexistent/path'

function getStackTraceCallerMethod(fileContent: string, stackTrace: string) {
  const stackTraceLines = stackTrace.split('\n')
  const callerTrace = stackTraceLines[0]

  const [, line, column] = callerTrace.split(':')
  const lineNumber = parseInt(line)
  const columnNumber = parseInt(column)

  const lines = fileContent.split('\n')
  const parsedLine = lines[lineNumber - 1].slice(columnNumber - 1)
  const match = parsedLine.match(/^(\w+)\s*\(/)
  if (match) {
    return match[1]
  }
  return null
}

async function expectTemplateToThrowAndCheckTrace(
  template: TemplateClass,
  expectedMethod: string
) {
  try {
    await Template.build(template, {
      alias: randomUUID(),
      cpuCount: 1,
      memoryMB: 1024,
    })
    // If we reach here, the test should fail because we expected an error
    assert.fail('Expected Template.build to throw an error')
  } catch (error) {
    if (error instanceof BuildError) {
      // Verify the error contains the expected method in the stack trace
      assert.include(
        getStackTraceCallerMethod(__fileContent, error.stack ?? ''),
        expectedMethod
      )
    } else {
      throw error
    }
  }
}

test('traces on fromImage', { timeout: testTimeout }, async () => {
  const template = Template().fromImage('e2b.dev/this-image-does-not-exist')
  await expectTemplateToThrowAndCheckTrace(template, 'fromImage')
})

test('traces on fromTemplate', { timeout: testTimeout }, async () => {
  const template = Template().fromTemplate('this-template-does-not-exist')
  await expectTemplateToThrowAndCheckTrace(template, 'fromTemplate')
})

test('traces on fromDockerfile', { timeout: testTimeout }, async () => {
  const template = Template().fromDockerfile(
    'FROM ubuntu:22.04\nRUN nonexistent'
  )
  await expectTemplateToThrowAndCheckTrace(template, 'fromDockerfile')
})

test('traces on fromRegistry', { timeout: testTimeout }, async () => {
  const template = Template().fromRegistry(
    'registry.example.com/nonexistent:latest',
    {
      username: 'test',
      password: 'test',
    }
  )
  await expectTemplateToThrowAndCheckTrace(template, 'fromRegistry')
})

test('traces on fromAWSRegistry', { timeout: testTimeout }, async () => {
  const template = Template().fromAWSRegistry(
    '123456789.dkr.ecr.us-east-1.amazonaws.com/nonexistent:latest',
    {
      accessKeyId: 'test',
      secretAccessKey: 'test',
      region: 'us-east-1',
    }
  )
  await expectTemplateToThrowAndCheckTrace(template, 'fromAWSRegistry')
})

test('traces on fromGCPRegistry', { timeout: testTimeout }, async () => {
  const template = Template().fromGCPRegistry(
    'gcr.io/nonexistent-project/nonexistent:latest',
    {
      serviceAccountJSON: { type: 'service_account' },
    }
  )
  await expectTemplateToThrowAndCheckTrace(template, 'fromGCPRegistry')
})

test('traces on copy', { timeout: testTimeout }, async () => {
  const template = Template()
    .fromBaseImage()
    .copy(nonExistentPath, nonExistentPath)
  await expectTemplateToThrowAndCheckTrace(template, 'copy')
})

test('traces on remove', { timeout: testTimeout }, async () => {
  const template = Template().fromBaseImage().remove(nonExistentPath)
  await expectTemplateToThrowAndCheckTrace(template, 'remove')
})

test('traces on rename', { timeout: testTimeout }, async () => {
  const template = Template()
    .fromBaseImage()
    .rename(nonExistentPath, '/tmp/dest.txt')
  await expectTemplateToThrowAndCheckTrace(template, 'rename')
})

test('traces on makeDir', { timeout: testTimeout }, async () => {
  const template = Template().fromBaseImage().makeDir('.bashrc')
  await expectTemplateToThrowAndCheckTrace(template, 'makeDir')
})

test('traces on makeSymlink', { timeout: testTimeout }, async () => {
  const template = Template().fromBaseImage().makeSymlink('.bashrc', '.bashrc')
  await expectTemplateToThrowAndCheckTrace(template, 'makeSymlink')
})

test('traces on runCmd', { timeout: testTimeout }, async () => {
  const template = Template().fromBaseImage().runCmd(`./${nonExistentPath}`)
  await expectTemplateToThrowAndCheckTrace(template, 'runCmd')
})

test('traces on setWorkdir', { timeout: testTimeout }, async () => {
  const template = Template().fromBaseImage().setWorkdir('.bashrc')
  await expectTemplateToThrowAndCheckTrace(template, 'setWorkdir')
})

test('traces on setUser', { timeout: testTimeout }, async () => {
  const template = Template().fromBaseImage().setUser(';')
  await expectTemplateToThrowAndCheckTrace(template, 'setUser')
})

test('traces on pipInstall', { timeout: testTimeout }, async () => {
  const template = Template().fromBaseImage().pipInstall('nonexistent-package')
  await expectTemplateToThrowAndCheckTrace(template, 'pipInstall')
})

test('traces on npmInstall', { timeout: testTimeout }, async () => {
  const template = Template().fromBaseImage().npmInstall('nonexistent-package')
  await expectTemplateToThrowAndCheckTrace(template, 'npmInstall')
})

test('traces on aptInstall', { timeout: testTimeout }, async () => {
  const template = Template().fromBaseImage().aptInstall('nonexistent-package')
  await expectTemplateToThrowAndCheckTrace(template, 'aptInstall')
})

test('traces on gitClone', { timeout: testTimeout }, async () => {
  const template = Template()
    .fromBaseImage()
    .gitClone('https://github.com/nonexistent/repo.git')
  await expectTemplateToThrowAndCheckTrace(template, 'gitClone')
})

test('traces on setStartCmd', { timeout: testTimeout }, async () => {
  const template = Template()
    .fromBaseImage()
    .setStartCmd(`./${nonExistentPath}`, waitForTimeout(10_000))
  await expectTemplateToThrowAndCheckTrace(template, 'setStartCmd')
})
