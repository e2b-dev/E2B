import { assert, test } from 'vitest'
import { Template, TemplateClass, waitForTimeout } from '../../src'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'

const __fileContent = fs.readFileSync(__filename, 'utf8') // read current file content
const testTimeout = 180000 // 3 minutes
const nonExistentPath = '/nonexistent/path'

function buildTemplate(template: TemplateClass) {
  return Template.build(template, {
    alias: randomUUID(),
    cpuCount: 1,
    memoryMB: 1024,
  })
}

function getStackTraceCallerMethod(
  fileContent: string,
  stackTrace: string | undefined
) {
  if (!stackTrace) {
    return null
  }

  const stackTraceLines = stackTrace.split('\n')
  const callerTrace = stackTraceLines[0]

  const [, line, column] = callerTrace.split(':')
  const lineNumber = parseInt(line)
  const columnNumber = parseInt(column)

  const lines = fileContent.split('\n')
  const parsedLine = lines[lineNumber - 1]
  if (!parsedLine) {
    return null
  }

  const match = parsedLine.slice(columnNumber - 1).match(/^(\w+)\s*\(/)
  if (match) {
    return match[1]
  }
  return null
}

async function expectToThrowAndCheckTrace(
  func: (...args: any[]) => Promise<void>,
  expectedMethod: string
) {
  try {
    await func()
    assert.fail('Expected Template.build to throw an error')
  } catch (error) {
    const callerMethod = getStackTraceCallerMethod(__fileContent, error.stack)
    if (!callerMethod) {
      throw error
    }
    assert.include(callerMethod, expectedMethod)
  }
}

test('traces on fromImage', { timeout: testTimeout }, async () => {
  const template = Template()
  template.fromImage('e2b.dev/this-image-does-not-exist')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'fromImage')
})

// TODO: uncomment this test when build system is updated
// test('traces on fromTemplate', { timeout: testTimeout }, async () => {
//   const template = Template().fromTemplate('this-template-does-not-exist')
//   await expectToThrowAndCheckTrace(async () => {
//     await buildTemplate(template)
//   }, 'fromTemplate')
// })

test('traces on fromDockerfile', { timeout: testTimeout }, async () => {
  const template = Template()
  template.fromDockerfile('FROM ubuntu:22.04\nRUN nonexistent')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'fromDockerfile')
})

test('traces on fromRegistry', { timeout: testTimeout }, async () => {
  const template = Template()
  template.fromRegistry('registry.example.com/nonexistent:latest', {
    username: 'test',
    password: 'test',
  })
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'fromRegistry')
})

test('traces on fromAWSRegistry', { timeout: testTimeout }, async () => {
  const template = Template()
  template.fromAWSRegistry(
    '123456789.dkr.ecr.us-east-1.amazonaws.com/nonexistent:latest',
    {
      accessKeyId: 'test',
      secretAccessKey: 'test',
      region: 'us-east-1',
    }
  )
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'fromAWSRegistry')
})

test('traces on fromGCPRegistry', { timeout: testTimeout }, async () => {
  const template = Template()
  template.fromGCPRegistry('gcr.io/nonexistent-project/nonexistent:latest', {
    serviceAccountJSON: { type: 'service_account' },
  })
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'fromGCPRegistry')
})

test('traces on copy', { timeout: testTimeout }, async () => {
  const template = Template().fromBaseImage()
  template.copy(nonExistentPath, nonExistentPath)
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'copy')
})

test('traces on remove', { timeout: testTimeout }, async () => {
  const template = Template().fromBaseImage()
  template.remove(nonExistentPath)
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'remove')
})

test('traces on rename', { timeout: testTimeout }, async () => {
  const template = Template().fromBaseImage()
  template.rename(nonExistentPath, '/tmp/dest.txt')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'rename')
})

test('traces on makeDir', { timeout: testTimeout }, async () => {
  const template = Template().fromBaseImage()
  template.makeDir('.bashrc')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'makeDir')
})

test('traces on makeSymlink', { timeout: testTimeout }, async () => {
  const template = Template().fromBaseImage()
  template.makeSymlink('.bashrc', '.bashrc')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'makeSymlink')
})

test('traces on runCmd', { timeout: testTimeout }, async () => {
  const template = Template().fromBaseImage()
  template.runCmd(`./${nonExistentPath}`)
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'runCmd')
})

test('traces on setWorkdir', { timeout: testTimeout }, async () => {
  const template = Template().fromBaseImage()
  template.setWorkdir('.bashrc')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'setWorkdir')
})

test('traces on setUser', { timeout: testTimeout }, async () => {
  const template = Template().fromBaseImage()
  template.setUser(';')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'setUser')
})

test('traces on pipInstall', { timeout: testTimeout }, async () => {
  const template = Template().fromBaseImage()
  template.pipInstall('nonexistent-package')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'pipInstall')
})

test('traces on npmInstall', { timeout: testTimeout }, async () => {
  const template = Template().fromBaseImage()
  template.npmInstall('nonexistent-package')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'npmInstall')
})

test('traces on aptInstall', { timeout: testTimeout }, async () => {
  const template = Template().fromBaseImage()
  template.aptInstall('nonexistent-package')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'aptInstall')
})

test('traces on gitClone', { timeout: testTimeout }, async () => {
  const template = Template().fromBaseImage()
  template.gitClone('https://github.com/nonexistent/repo.git')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'gitClone')
})

test('traces on setStartCmd', { timeout: testTimeout }, async () => {
  const template = Template().fromBaseImage()
  template.setStartCmd(`./${nonExistentPath}`, waitForTimeout(10_000))
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'setStartCmd')
})
