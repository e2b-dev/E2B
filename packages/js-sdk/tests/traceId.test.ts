import { assert, describe, test } from 'vitest'
import { extractTraceId } from '../src/traceId'
import {
  AuthenticationError,
  BuildError,
  SandboxError,
  TimeoutError,
  VolumeError,
} from '../src/errors'

describe('extractTraceId', () => {
  test('returns undefined without headers', () => {
    assert.isUndefined(extractTraceId())
    assert.isUndefined(extractTraceId(undefined))
  })

  test('returns undefined when no trace header is present', () => {
    assert.isUndefined(extractTraceId(new Headers({ 'content-type': 'text' })))
  })

  test('reads X-Trace-ID verbatim', () => {
    const headers = new Headers({ 'X-Trace-ID': 'abc123' })
    assert.equal(extractTraceId(headers), 'abc123')
  })

  test('ignores an empty X-Trace-ID', () => {
    const headers = new Headers({ 'X-Trace-ID': '  ' })
    assert.isUndefined(extractTraceId(headers))
  })

  test('reads the trace ID part of X-Cloud-Trace-Context', () => {
    const headers = new Headers({
      'X-Cloud-Trace-Context': '105445aa7843bc8bf206b12000100000/1;o=1',
    })
    assert.equal(extractTraceId(headers), '105445aa7843bc8bf206b12000100000')
  })

  test('normalizes X-Amzn-Trace-Id to the 32-hex trace ID', () => {
    const headers = new Headers({
      'X-Amzn-Trace-Id': 'Root=1-5759e988-bd862e3fe1be46a994272793;Sampled=1',
    })
    assert.equal(extractTraceId(headers), '5759e988bd862e3fe1be46a994272793')
  })

  test('falls back to the raw Root value for an unexpected AWS format', () => {
    const headers = new Headers({ 'X-Amzn-Trace-Id': 'Root=custom-value' })
    assert.equal(extractTraceId(headers), 'custom-value')
  })

  test('prefers X-Trace-ID over the cloud edge headers', () => {
    const headers = new Headers({
      'X-Trace-ID': 'explicit',
      'X-Cloud-Trace-Context': '105445aa7843bc8bf206b12000100000/1;o=1',
      'X-Amzn-Trace-Id': 'Root=1-5759e988-bd862e3fe1be46a994272793',
    })
    assert.equal(extractTraceId(headers), 'explicit')
  })
})

describe('error classes with a trace ID', () => {
  test('SandboxError appends the trace ID to the message', () => {
    const err = new SandboxError('500: failure', { traceId: 'abc123' })
    assert.equal(err.message, '500: failure (trace ID: abc123)')
  })

  test('SandboxError leaves the message unchanged without a trace ID', () => {
    const err = new SandboxError('500: failure')
    assert.equal(err.message, '500: failure')
  })

  test('AuthenticationError appends the trace ID to the message', () => {
    const err = new AuthenticationError('unauthorized', { traceId: 'abc123' })
    assert.equal(err.message, 'unauthorized (trace ID: abc123)')
  })

  test('subclasses append the trace ID to the message', () => {
    const err = new TimeoutError('timed out', { traceId: 'abc123' })
    assert.equal(err.message, 'timed out (trace ID: abc123)')
  })

  test('the trace ID is readable as a property', () => {
    assert.equal(
      new SandboxError('500: failure', { traceId: 'abc123' }).traceId,
      'abc123'
    )
    assert.equal(
      new TimeoutError('timed out', { traceId: 'abc123' }).traceId,
      'abc123'
    )
    assert.equal(
      new AuthenticationError('unauthorized', { traceId: 'abc123' }).traceId,
      'abc123'
    )
    assert.equal(
      new BuildError('build failed', { traceId: 'abc123' }).traceId,
      'abc123'
    )
    assert.equal(
      new VolumeError('volume failed', { traceId: 'abc123' }).traceId,
      'abc123'
    )
  })

  test('the trace ID property is undefined when there is none', () => {
    assert.isUndefined(new SandboxError('500: failure').traceId)
  })
})
