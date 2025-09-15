import { assert, test } from 'vitest'
import { Template, waitForTimeout } from '../../src'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'

// read current file content
const __fileContent = fs.readFileSync(__filename, 'utf8')

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

test('traces on fromImage', { timeout: 180000 }, async () => {
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

test('traces on runCmd', { timeout: 180000 }, async () => {
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
