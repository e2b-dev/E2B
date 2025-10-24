import fs from 'node:fs'
import { assert } from 'vitest'
import { Template, waitForTimeout } from '../../src'
import { buildTemplateTest } from '../setup'

const __fileContent = fs.readFileSync(__filename, 'utf8') // read current file content
const nonExistentPath = '/nonexistent/path'

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

buildTemplateTest('traces on fromImage', async ({ buildTemplate }) => {
  const templateFrom = Template()
  const template = templateFrom.fromImage('e2b.dev/this-image-does-not-exist')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template, true)
  }, 'fromImage')
})

buildTemplateTest('traces on fromTemplate', async ({ buildTemplate }) => {
  const templateFrom = Template()
  const template = templateFrom.fromTemplate('this-template-does-not-exist')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'fromTemplate')
})

buildTemplateTest('traces on fromDockerfile', async ({ buildTemplate }) => {
  const templateFrom = Template()
  const template = templateFrom.fromDockerfile(
    'FROM ubuntu:22.04\nRUN nonexistent'
  )
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'fromDockerfile')
})

buildTemplateTest('traces on fromImage registry', async ({ buildTemplate }) => {
  const templateFrom = Template()
  const template = templateFrom.fromImage(
    'registry.example.com/nonexistent:latest',
    {
      username: 'test',
      password: 'test',
    }
  )
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template, true)
  }, 'fromImage')
})

buildTemplateTest('traces on fromAWSRegistry', async ({ buildTemplate }) => {
  const templateFrom = Template()
  const template = templateFrom.fromAWSRegistry(
    '123456789.dkr.ecr.us-east-1.amazonaws.com/nonexistent:latest',
    {
      accessKeyId: 'test',
      secretAccessKey: 'test',
      region: 'us-east-1',
    }
  )
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template, true)
  }, 'fromAWSRegistry')
})

buildTemplateTest('traces on fromGCPRegistry', async ({ buildTemplate }) => {
  const templateFrom = Template()
  const template = templateFrom.fromGCPRegistry(
    'gcr.io/nonexistent-project/nonexistent:latest',
    {
      serviceAccountJSON: { type: 'service_account' },
    }
  )
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template, true)
  }, 'fromGCPRegistry')
})

buildTemplateTest('traces on copy', async ({ buildTemplate }) => {
  let template = Template().fromBaseImage()
  template = template.skipCache().copy(nonExistentPath, nonExistentPath)
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'copy')
})

buildTemplateTest('traces on copyItems', async ({ buildTemplate }) => {
  let template = Template().fromBaseImage()
  template = template
    .skipCache()
    .copyItems([{ src: nonExistentPath, dest: nonExistentPath }])
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'copyItems')
})

buildTemplateTest('traces on remove', async ({ buildTemplate }) => {
  let template = Template().fromBaseImage()
  template = template.skipCache().remove(nonExistentPath)
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'remove')
})

buildTemplateTest('traces on rename', async ({ buildTemplate }) => {
  let template = Template().fromBaseImage()
  template = template.skipCache().rename(nonExistentPath, '/tmp/dest.txt')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'rename')
})

buildTemplateTest('traces on makeDir', async ({ buildTemplate }) => {
  let template = Template().fromBaseImage()
  template = template.skipCache().makeDir('.bashrc')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'makeDir')
})

buildTemplateTest('traces on makeSymlink', async ({ buildTemplate }) => {
  let template = Template().fromBaseImage()
  template = template.skipCache().makeSymlink('.bashrc', '.bashrc')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'makeSymlink')
})

buildTemplateTest('traces on runCmd', async ({ buildTemplate }) => {
  let template = Template().fromBaseImage()
  template = template.skipCache().runCmd(`./${nonExistentPath}`)
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'runCmd')
})

buildTemplateTest('traces on setWorkdir', async ({ buildTemplate }) => {
  const template = Template()
    .fromBaseImage()
    .setUser('root')
    .skipCache()
    .setWorkdir('/root/.bashrc')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'setWorkdir')
})

buildTemplateTest('traces on setUser', async ({ buildTemplate }) => {
  let template = Template().fromBaseImage()
  template = template.skipCache().setUser('; exit 1')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'setUser')
})

buildTemplateTest('traces on pipInstall', async ({ buildTemplate }) => {
  let template = Template().fromBaseImage()
  template = template.skipCache().pipInstall('nonexistent-package')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'pipInstall')
})

buildTemplateTest('traces on npmInstall', async ({ buildTemplate }) => {
  let template = Template().fromBaseImage()
  template = template.skipCache().npmInstall('nonexistent-package')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'npmInstall')
})

buildTemplateTest('traces on aptInstall', async ({ buildTemplate }) => {
  let template = Template().fromBaseImage()
  template = template.skipCache().aptInstall('nonexistent-package')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'aptInstall')
})

buildTemplateTest('traces on gitClone', async ({ buildTemplate }) => {
  let template = Template().fromBaseImage()
  template = template
    .skipCache()
    .gitClone('https://github.com/nonexistent/repo.git')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'gitClone')
})

buildTemplateTest('traces on setStartCmd', async ({ buildTemplate }) => {
  let template: any = Template().fromBaseImage()
  template = template.setStartCmd(
    `./${nonExistentPath}`,
    waitForTimeout(10_000)
  )
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template)
  }, 'setStartCmd')
})

buildTemplateTest('traces on addMcpServer', async () => {
  // needs mcp-gateway as base template, without it no mcp servers can be added
  await expectToThrowAndCheckTrace(async () => {
    Template().fromBaseImage().addMcpServer('exa')
  }, 'addMcpServer')
})

buildTemplateTest(
  'traces on devcontainerPrebuild',
  async ({ buildTemplate }) => {
    let template = Template().fromTemplate('devcontainer')
    template = template.skipCache().devcontainerPrebuild(nonExistentPath)
    await expectToThrowAndCheckTrace(async () => {
      await buildTemplate(template)
    }, 'devcontainerPrebuild')
  }
)

buildTemplateTest(
  'traces on setDevcontainerStart',
  async ({ buildTemplate }) => {
    const template = Template()
      .fromTemplate('devcontainer')
      .setDevcontainerStart(nonExistentPath)
    await expectToThrowAndCheckTrace(async () => {
      await buildTemplate(template)
    }, 'setDevcontainerStart')
  }
)
