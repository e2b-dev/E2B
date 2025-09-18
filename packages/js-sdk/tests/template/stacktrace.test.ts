import { assert, test } from 'vitest'
import { Template, TemplateClass, waitForTimeout } from '../../src'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'

const __fileContent = fs.readFileSync(__filename, 'utf8') // read current file content
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
  if (stackTraceLines.length === 0) {
    return null
  }
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

test('traces on fromImage', async () => {
  const template = Template()
  template.fromImage('e2b.dev/this-image-does-not-exist')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'fromImage')
})

// TODO: uncomment this test when build system is updated
// test('traces on fromTemplate', async () => {
//   const template = Template()
//   template.fromTemplate('this-template-does-not-exist')
//   await expectToThrowAndCheckTrace(async () => {
//     await buildTemplate(template)
//   }, 'fromTemplate')
// })

test('traces on fromDockerfile', async () => {
  const template = Template()
  template.fromDockerfile('FROM ubuntu:22.04\nRUN nonexistent')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'fromDockerfile')
})

test('traces on fromRegistry', async () => {
  const template = Template()
  template.fromRegistry('registry.example.com/nonexistent:latest', {
    username: 'test',
    password: 'test',
  })
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'fromRegistry')
})

test('traces on fromAWSRegistry', async () => {
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

test('traces on fromGCPRegistry', async () => {
  const template = Template()
  template.fromGCPRegistry('gcr.io/nonexistent-project/nonexistent:latest', {
    serviceAccountJSON: { type: 'service_account' },
  })
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'fromGCPRegistry')
})

test('traces on copy', async () => {
  let template = Template().fromBaseImage()
  template = template.copy(nonExistentPath, nonExistentPath)
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'copy')
})

test('traces on remove', async () => {
  let template = Template().fromBaseImage()
  template = template.remove(nonExistentPath)
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'remove')
})

test('traces on rename', async () => {
  let template = Template().fromBaseImage()
  template = template.rename(nonExistentPath, '/tmp/dest.txt')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'rename')
})

test('traces on makeDir', async () => {
  let template = Template().fromBaseImage()
  template = template.makeDir('.bashrc')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'makeDir')
})

test('traces on makeSymlink', async () => {
  let template = Template().fromBaseImage()
  template = template.makeSymlink('.bashrc', '.bashrc')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'makeSymlink')
})

test('traces on runCmd', async () => {
  let template = Template().fromBaseImage()
  template = template.runCmd(`./${nonExistentPath}`)
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'runCmd')
})

test('traces on setWorkdir', async () => {
  let template = Template().fromBaseImage()
  template = template.setWorkdir('.bashrc')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'setWorkdir')
})

test('traces on setUser', async () => {
  let template = Template().fromBaseImage()
  template = template.setUser(';')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'setUser')
})

test('traces on pipInstall', async () => {
  let template = Template().fromBaseImage()
  template = template.pipInstall('nonexistent-package')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'pipInstall')
})

test('traces on npmInstall', async () => {
  let template = Template().fromBaseImage()
  template = template.npmInstall('nonexistent-package')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'npmInstall')
})

test('traces on aptInstall', async () => {
  let template = Template().fromBaseImage()
  template = template.aptInstall('nonexistent-package')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'aptInstall')
})

test('traces on gitClone', async () => {
  let template = Template().fromBaseImage()
  template = template.gitClone('https://github.com/nonexistent/repo.git')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'gitClone')
})

test('traces on setStartCmd', async () => {
  let template: any = Template().fromBaseImage()
  template = template.setStartCmd(
    `./${nonExistentPath}`,
    waitForTimeout(10_000)
  )
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'setStartCmd')
})
