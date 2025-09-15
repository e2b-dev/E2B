import { assert, test } from 'vitest'
import { Template, waitForTimeout } from '../../src'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'

// read current file content
const __fileContent = fs.readFileSync(__filename, 'utf8')

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

test('traces on fromImage', { timeout: testTimeout }, async () => {
  const template = Template().fromImage('e2b.dev/this-image-does-not-exist')

  try {
    await Template.build(template, {
      alias: randomUUID(),
      cpuCount: 1,
      memoryMB: 1024,
    })
  } catch (error) {
    assert.include(
      getStackTraceCallerMethod(__fileContent, error.stack),
      'fromImage'
    )
  }
})

test('traces on fromTemplate', { timeout: testTimeout }, async () => {
  const template = Template().fromTemplate('this-template-does-not-exist')

  try {
    await Template.build(template, {
      alias: randomUUID(),
      cpuCount: 1,
      memoryMB: 1024,
    })
  } catch (error) {
    assert.include(
      getStackTraceCallerMethod(__fileContent, error.stack),
      'fromTemplate'
    )
  }
})

test('traces on fromDockerfile', { timeout: testTimeout }, async () => {
  const template = Template().fromDockerfile(
    'FROM nonexistent:latest\nRUN echo "test"'
  )

  try {
    await Template.build(template, {
      alias: randomUUID(),
      cpuCount: 1,
      memoryMB: 1024,
    })
  } catch (error) {
    assert.include(
      getStackTraceCallerMethod(__fileContent, error.stack),
      'fromDockerfile'
    )
  }
})

test('traces on fromRegistry', { timeout: testTimeout }, async () => {
  const template = Template().fromRegistry(
    'registry.example.com/nonexistent:latest',
    {
      username: 'test',
      password: 'test',
    }
  )

  try {
    await Template.build(template, {
      alias: randomUUID(),
      cpuCount: 1,
      memoryMB: 1024,
    })
  } catch (error) {
    assert.include(
      getStackTraceCallerMethod(__fileContent, error.stack),
      'fromRegistry'
    )
  }
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

  try {
    await Template.build(template, {
      alias: randomUUID(),
      cpuCount: 1,
      memoryMB: 1024,
    })
  } catch (error) {
    assert.include(
      getStackTraceCallerMethod(__fileContent, error.stack),
      'fromAWSRegistry'
    )
  }
})

test('traces on fromGCPRegistry', { timeout: testTimeout }, async () => {
  const template = Template().fromGCPRegistry(
    'gcr.io/nonexistent-project/nonexistent:latest',
    {
      serviceAccountJSON: { type: 'service_account' },
    }
  )

  try {
    await Template.build(template, {
      alias: randomUUID(),
      cpuCount: 1,
      memoryMB: 1024,
    })
  } catch (error) {
    assert.include(
      getStackTraceCallerMethod(__fileContent, error.stack),
      'fromGCPRegistry'
    )
  }
})

// Copy currently throws a different error when files not found
// test('traces on copy', { timeout: testTimeout }, async () => {
//   try {
//     const template = Template()
//       .fromImage('ubuntu:22.04')
//       .copy('/nonexistent/test.txt', '/tmp/test.txt')

//     await Template.build(template, {
//       alias: randomUUID(),
//       cpuCount: 1,
//       memoryMB: 1024,
//     })
//   } catch (error) {
//     assert.include(
//       getStackTraceCallerMethod(__fileContent, error.stack),
//       'copy'
//     )
//   }
// })

test('traces on remove', { timeout: testTimeout }, async () => {
  const template = Template().fromImage('ubuntu:22.04').remove(nonExistentPath)

  try {
    await Template.build(template, {
      alias: randomUUID(),
      cpuCount: 1,
      memoryMB: 1024,
    })
  } catch (error) {
    assert.include(
      getStackTraceCallerMethod(__fileContent, error.stack),
      'remove'
    )
  }
})

test('traces on rename', { timeout: testTimeout }, async () => {
  const template = Template()
    .fromImage('ubuntu:22.04')
    .rename(nonExistentPath, '/tmp/dest.txt')

  try {
    await Template.build(template, {
      alias: randomUUID(),
      cpuCount: 1,
      memoryMB: 1024,
    })
  } catch (error) {
    assert.include(
      getStackTraceCallerMethod(__fileContent, error.stack),
      'rename'
    )
  }
})

test('traces on makeDir', { timeout: testTimeout }, async () => {
  const template = Template().fromImage('ubuntu:22.04').makeDir('/tmp/testdir')

  try {
    await Template.build(template, {
      alias: randomUUID(),
      cpuCount: 1,
      memoryMB: 1024,
    })
  } catch (error) {
    assert.include(
      getStackTraceCallerMethod(__fileContent, error.stack),
      'makeDir'
    )
  }
})

test('traces on makeSymlink', { timeout: testTimeout }, async () => {
  const template = Template()
    .fromImage('ubuntu:22.04')
    .makeSymlink(nonExistentPath, '/tmp/link')

  try {
    await Template.build(template, {
      alias: randomUUID(),
      cpuCount: 1,
      memoryMB: 1024,
    })
  } catch (error) {
    assert.include(
      getStackTraceCallerMethod(__fileContent, error.stack),
      'makeSymlink'
    )
  }
})

test('traces on runCmd', { timeout: testTimeout }, async () => {
  const template = Template()
    .fromImage('ubuntu:22.04')
    .runCmd('cat folder/test.txt')

  try {
    await Template.build(template, {
      alias: randomUUID(),
      cpuCount: 1,
      memoryMB: 1024,
    })
  } catch (error) {
    assert.include(
      getStackTraceCallerMethod(__fileContent, error.stack),
      'runCmd'
    )
  }
})

test('traces on setWorkdir', { timeout: testTimeout }, async () => {
  const template = Template()
    .fromImage('ubuntu:22.04')
    .setWorkdir(nonExistentPath)

  try {
    await Template.build(template, {
      alias: randomUUID(),
      cpuCount: 1,
      memoryMB: 1024,
    })
  } catch (error) {
    assert.include(
      getStackTraceCallerMethod(__fileContent, error.stack),
      'setWorkdir'
    )
  }
})

test('traces on setUser', { timeout: testTimeout }, async () => {
  const template = Template().fromImage('ubuntu:22.04').setUser('non-existent')

  try {
    await Template.build(template, {
      alias: randomUUID(),
      cpuCount: 1,
      memoryMB: 1024,
    })
  } catch (error) {
    assert.include(
      getStackTraceCallerMethod(__fileContent, error.stack),
      'setUser'
    )
  }
})

test('traces on pipInstall', { timeout: testTimeout }, async () => {
  const template = Template()
    .fromImage('python:3.13')
    .pipInstall('nonexistent-package')

  try {
    await Template.build(template, {
      alias: randomUUID(),
      cpuCount: 1,
      memoryMB: 1024,
    })
  } catch (error) {
    assert.include(
      getStackTraceCallerMethod(__fileContent, error.stack),
      'pipInstall'
    )
  }
})

test('traces on npmInstall', { timeout: testTimeout }, async () => {
  const template = Template()
    .fromImage('node:lts')
    .npmInstall('nonexistent-package')

  try {
    await Template.build(template, {
      alias: randomUUID(),
      cpuCount: 1,
      memoryMB: 1024,
    })
  } catch (error) {
    assert.include(
      getStackTraceCallerMethod(__fileContent, error.stack),
      'npmInstall'
    )
  }
})

test('traces on aptInstall', { timeout: testTimeout }, async () => {
  const template = Template()
    .fromImage('ubuntu:22.04')
    .aptInstall('nonexistent-package')

  try {
    await Template.build(template, {
      alias: randomUUID(),
      cpuCount: 1,
      memoryMB: 1024,
    })
  } catch (error) {
    assert.include(
      getStackTraceCallerMethod(__fileContent, error.stack),
      'aptInstall'
    )
  }
})

test('traces on gitClone', { timeout: testTimeout }, async () => {
  const template = Template()
    .fromImage('ubuntu:22.04')
    .gitClone('https://github.com/nonexistent/repo.git')

  try {
    await Template.build(template, {
      alias: randomUUID(),
      cpuCount: 1,
      memoryMB: 1024,
    })
  } catch (error) {
    assert.include(
      getStackTraceCallerMethod(__fileContent, error.stack),
      'gitClone'
    )
  }
})

test('traces on setStartCmd', { timeout: testTimeout }, async () => {
  const template = Template()
    .fromImage('ubuntu:22.04')
    .setStartCmd(`./${nonExistentPath}`, waitForTimeout(10_000))

  try {
    await Template.build(template, {
      alias: randomUUID(),
      cpuCount: 1,
      memoryMB: 1024,
    })
  } catch (error) {
    assert.include(
      getStackTraceCallerMethod(__fileContent, error.stack),
      'setStartCmd'
    )
  }
})
