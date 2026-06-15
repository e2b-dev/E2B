import { expect, test, describe } from 'vitest'
import {
  waitForFile,
  waitForPort,
  waitForProcess,
  waitForTimeout,
  waitForURL,
} from '../../../src/template/readycmd'

describe('readycmd', () => {
  test('waitForPort anchors the port match', () => {
    const cmd = waitForPort(80).getCmd()
    expect(cmd).toBe("ss -tuln | grep -E ':80([[:space:]]|$)'")
  })

  test('waitForURL quotes the url', () => {
    const cmd = waitForURL('http://localhost:3000/health?ready=1&x=y').getCmd()
    expect(cmd).toBe(
      'curl -s -o /dev/null -w "%{http_code}" \'http://localhost:3000/health?ready=1&x=y\' | grep -q "200"'
    )
  })

  test('waitForURL keeps simple urls unquoted', () => {
    const cmd = waitForURL('http://localhost:3000/health').getCmd()
    expect(cmd).toBe(
      'curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health | grep -q "200"'
    )
  })

  test('waitForProcess quotes the process name', () => {
    const cmd = waitForProcess('my daemon').getCmd()
    expect(cmd).toBe("pgrep 'my daemon' > /dev/null")
  })

  test('waitForFile quotes the filename', () => {
    const cmd = waitForFile('/tmp/ready file').getCmd()
    expect(cmd).toBe("[ -f '/tmp/ready file' ]")
  })

  test('waitForFile keeps simple paths unquoted', () => {
    const cmd = waitForFile('/tmp/ready').getCmd()
    expect(cmd).toBe('[ -f /tmp/ready ]')
  })

  test('waitForTimeout converts milliseconds to seconds', () => {
    expect(waitForTimeout(5000).getCmd()).toBe('sleep 5')
    expect(waitForTimeout(100).getCmd()).toBe('sleep 1')
  })
})
