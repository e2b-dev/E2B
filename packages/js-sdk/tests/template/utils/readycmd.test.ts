import { expect, test, describe } from 'vitest'
import {
  waitForFile,
  waitForPort,
  waitForProcess,
  waitForTimeout,
  waitForURL,
} from '../../../src/template/readycmd'
import { InvalidArgumentError } from '../../../src/errors'

describe('readycmd', () => {
  test('waitForPort matches the exact listening port', () => {
    const cmd = waitForPort(80).getCmd()
    expect(cmd).toBe('[ -n "$(ss -Htuln sport = :80)" ]')
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

  test.each([[0], [65536], [80.5], [NaN], ['80; reboot']])(
    'waitForPort refuses %j',
    (port) => {
      expect(() => waitForPort(port as number)).toThrow(InvalidArgumentError)
    }
  )

  test.each([[20], [1000], [200.5], [NaN], ['200']])(
    'waitForURL refuses status code %j',
    (statusCode) => {
      expect(() =>
        waitForURL('http://localhost:3000', statusCode as number)
      ).toThrow(InvalidArgumentError)
    }
  )

  test.each([[NaN], [-1], [Infinity], ['5000']])(
    'waitForTimeout refuses %j',
    (timeout) => {
      expect(() => waitForTimeout(timeout as number)).toThrow(
        InvalidArgumentError
      )
    }
  )
})
