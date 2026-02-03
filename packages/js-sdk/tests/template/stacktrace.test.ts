import fs from 'node:fs'
import { assert, afterAll, afterEach, beforeAll } from 'vitest'

import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { Template, waitForTimeout } from '../../src'
import { apiUrl, buildTemplateTest } from '../setup'
import { randomUUID } from 'node:crypto'

const __fileContent = fs.readFileSync(__filename, 'utf8') // read current file content
const nonExistentPath = './nonexistent/path'

// map template alias -> failed step index
const failureMap: Record<string, number | undefined> = {
  fromImage: 0,
  fromTemplate: 0,
  fromDockerfile: 0,
  fromImageRegistry: 0,
  fromAWSRegistry: 0,
  fromGCPRegistry: 0,
  copy: undefined,
  copyItems: undefined,
  remove: 1,
  rename: 1,
  makeDir: 1,
  makeSymlink: 1,
  runCmd: 1,
  setWorkdir: 1,
  setUser: 1,
  pipInstall: 1,
  npmInstall: 1,
  aptInstall: 1,
  gitClone: 1,
  setStartCmd: 1,
  addMcpServer: undefined,
  betaDevContainerPrebuild: 1,
  betaSetDevContainerStart: 1,
}

export const restHandlers = [
  http.post(apiUrl('/v3/templates'), async ({ request }) => {
    const { name } = (await request.clone().json()) as { name: string }
    return HttpResponse.json({
      buildID: randomUUID(),
      templateID: name,
      tags: [],
    })
  }),
  http.post(apiUrl('/v2/templates/:templateID/builds/:buildID'), () => {
    return HttpResponse.json({})
  }),
  http.get<{ templateID: string; buildID: string }>(
    apiUrl('/templates/:templateID/builds/:buildID/status'),
    ({ params }) => {
      const { templateID } = params
      return HttpResponse.json({
        status: 'error',
        reason: {
          message: 'Mocked API build error',
          step: failureMap[templateID],
        },
        logEntries: [],
      })
    }
  ),
]

const server = setupServer(...restHandlers)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

afterAll(() => server.close())

afterEach(() => server.resetHandlers())

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

  // Match line and column numbers at the end of the stack trace line
  // Format: ...file.ts:123:45) or ...file.ts:123:45
  // This handles Windows paths (C:\Users\...) and Unix paths
  const lineColumnMatch = callerTrace.match(/:(\d+):(\d+)\)?$/)
  if (!lineColumnMatch) {
    return null
  }
  const lineNumber = parseInt(lineColumnMatch[1])
  const columnNumber = parseInt(lineColumnMatch[2])

  const lines = fileContent.split('\n')
  const parsedLine = lines[lineNumber - 1]
  if (!parsedLine) {
    return null
  }

  // Extract the method name from the line
  const methodNameMatch = parsedLine
    .slice(columnNumber - 1)
    .match(/^(\w+)\s*\(/)
  if (methodNameMatch) {
    return methodNameMatch[1]
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
  const template = Template().fromImage('e2b.dev/this-image-does-not-exist')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template, { name: 'fromImage', skipCache: true })
  }, 'fromImage')
})

buildTemplateTest('traces on fromTemplate', async ({ buildTemplate }) => {
  const template = Template().fromTemplate('this-template-does-not-exist')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template, { name: 'fromTemplate', skipCache: true })
  }, 'fromTemplate')
})

buildTemplateTest('traces on fromDockerfile', async ({ buildTemplate }) => {
  const template = Template().fromDockerfile(
    'FROM ubuntu:22.04\nRUN nonexistent'
  )
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template, { name: 'fromDockerfile', skipCache: true })
  }, 'fromDockerfile')
})

buildTemplateTest('traces on fromImage registry', async ({ buildTemplate }) => {
  const template = Template().fromImage(
    'registry.example.com/nonexistent:latest',
    {
      username: 'test',
      password: 'test',
    }
  )
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template, {
      name: 'fromImageRegistry',
    })
  }, 'fromImage')
})

buildTemplateTest('traces on fromAWSRegistry', async ({ buildTemplate }) => {
  const template = Template().fromAWSRegistry(
    '123456789.dkr.ecr.us-east-1.amazonaws.com/nonexistent:latest',
    {
      accessKeyId: 'test',
      secretAccessKey: 'test',
      region: 'us-east-1',
    }
  )
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template, { name: 'fromAWSRegistry' })
  }, 'fromAWSRegistry')
})

buildTemplateTest('traces on fromGCPRegistry', async ({ buildTemplate }) => {
  const template = Template().fromGCPRegistry(
    'gcr.io/nonexistent-project/nonexistent:latest',
    {
      serviceAccountJSON: { type: 'service_account' },
    }
  )
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template, { name: 'fromGCPRegistry' })
  }, 'fromGCPRegistry')
})

buildTemplateTest('traces on copy', async ({ buildTemplate }) => {
  let template = Template().fromBaseImage()
  template = template.skipCache().copy(nonExistentPath, nonExistentPath)
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template, { name: 'copy' })
  }, 'copy')
})

buildTemplateTest('traces on copyItems', async ({ buildTemplate }) => {
  let template = Template().fromBaseImage()
  template = template
    .skipCache()
    .copyItems([{ src: nonExistentPath, dest: nonExistentPath }])
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template, { name: 'copyItems' })
  }, 'copyItems')
})

buildTemplateTest('traces on remove', async ({ buildTemplate }) => {
  let template = Template().fromBaseImage()
  template = template.skipCache().remove(nonExistentPath)
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template, { name: 'remove' })
  }, 'remove')
})

buildTemplateTest('traces on rename', async ({ buildTemplate }) => {
  let template = Template().fromBaseImage()
  template = template.skipCache().rename(nonExistentPath, '/tmp/dest.txt')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template, { name: 'rename' })
  }, 'rename')
})

buildTemplateTest('traces on makeDir', async ({ buildTemplate }) => {
  let template = Template().fromBaseImage()
  template = template.skipCache().makeDir('.bashrc')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template, { name: 'makeDir' })
  }, 'makeDir')
})

buildTemplateTest('traces on makeSymlink', async ({ buildTemplate }) => {
  let template = Template().fromBaseImage()
  template = template.skipCache().makeSymlink('.bashrc', '.bashrc')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template, { name: 'makeSymlink' })
  }, 'makeSymlink')
})

buildTemplateTest('traces on runCmd', async ({ buildTemplate }) => {
  let template = Template().fromBaseImage()
  template = template.skipCache().runCmd(`./${nonExistentPath}`)
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template, { name: 'runCmd' })
  }, 'runCmd')
})

buildTemplateTest('traces on setWorkdir', async ({ buildTemplate }) => {
  let template = Template().fromBaseImage()
  template = template.skipCache().setWorkdir('/root/.bashrc')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template, { name: 'setWorkdir' })
  }, 'setWorkdir')
})

buildTemplateTest('traces on setUser', async ({ buildTemplate }) => {
  let template = Template().fromBaseImage()
  template = template.skipCache().setUser('; exit 1')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template, { name: 'setUser' })
  }, 'setUser')
})

buildTemplateTest('traces on pipInstall', async ({ buildTemplate }) => {
  let template = Template().fromBaseImage()
  template = template.skipCache().pipInstall('nonexistent-package')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template, { name: 'pipInstall' })
  }, 'pipInstall')
})

buildTemplateTest('traces on npmInstall', async ({ buildTemplate }) => {
  let template = Template().fromBaseImage()
  template = template.skipCache().npmInstall('nonexistent-package')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template, { name: 'npmInstall' })
  }, 'npmInstall')
})

buildTemplateTest('traces on aptInstall', async ({ buildTemplate }) => {
  let template = Template().fromBaseImage()
  template = template.skipCache().aptInstall('nonexistent-package')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template, { name: 'aptInstall' })
  }, 'aptInstall')
})

buildTemplateTest('traces on gitClone', async ({ buildTemplate }) => {
  let template = Template().fromBaseImage()
  template = template
    .skipCache()
    .gitClone('https://github.com/nonexistent/repo.git')
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template, { name: 'gitClone' })
  }, 'gitClone')
})

buildTemplateTest('traces on setStartCmd', async ({ buildTemplate }) => {
  let template: any = Template().fromBaseImage()
  template = template.setStartCmd(
    `./${nonExistentPath}`,
    waitForTimeout(10_000)
  )
  await expectToThrowAndCheckTrace(async () => {
    await buildTemplate(template, { name: 'setStartCmd' })
  }, 'setStartCmd')
})

buildTemplateTest('traces on addMcpServer', async () => {
  // needs mcp-gateway as base template, without it no mcp servers can be added
  await expectToThrowAndCheckTrace(async () => {
    Template().fromBaseImage().skipCache().addMcpServer('exa')
  }, 'addMcpServer')
})

buildTemplateTest(
  'traces on betaDevContainerPrebuild',
  async ({ buildTemplate }) => {
    const template = Template()
      .fromTemplate('devcontainer')
      .skipCache()
      .betaDevContainerPrebuild(nonExistentPath)
    await expectToThrowAndCheckTrace(async () => {
      await buildTemplate(template, {
        name: 'betaDevContainerPrebuild',
      })
    }, 'betaDevContainerPrebuild')
  }
)

buildTemplateTest(
  'traces on betaSetDevContainerStart',
  async ({ buildTemplate }) => {
    const template = Template()
      .fromTemplate('devcontainer')
      .betaSetDevContainerStart(nonExistentPath)
    await expectToThrowAndCheckTrace(async () => {
      await buildTemplate(template, {
        name: 'betaSetDevContainerStart',
      })
    }, 'betaSetDevContainerStart')
  }
)
