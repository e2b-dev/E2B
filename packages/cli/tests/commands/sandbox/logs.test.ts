import { describe, expect, test } from 'vitest'

import {
  LogLevel,
  normalizeSandboxLogLineForOutput,
} from '../../../src/commands/sandbox/logs'

const timestamp = '2026-04-22T21:00:00.000Z'

describe('normalizeSandboxLogLineForOutput', () => {
  test('promotes fields from a single structured data object', () => {
    const [entry] = normalizeSandboxLogLineForOutput(
      timestamp,
      JSON.stringify({
        level: 'info',
        logger: 'process',
        message: 'Streaming process event',
        data: JSON.stringify({
          severity: 'ERROR',
          logger: 'operator.HTTP.SetupCommand',
          message: 'setup failed',
          request_id: 'req_123',
        }),
      })
    )

    expect(entry).toEqual({
      timestamp,
      level: LogLevel.ERROR,
      log: {
        level: LogLevel.ERROR,
        origin: 'user',
        logger: 'operator.HTTP.SetupCommand',
        message: 'setup failed',
        captured_by: {
          logger: 'process',
          message: 'Streaming process event',
        },
        data: {
          request_id: 'req_123',
        },
      },
    })
  })

  test('splits structured JSONL data into printable entries', () => {
    const entries = normalizeSandboxLogLineForOutput(
      timestamp,
      JSON.stringify({
        level: 'info',
        logger: 'process',
        message: 'Streaming process event',
        event_type: 'stdout',
        data: [
          JSON.stringify({
            severity: 'INFO',
            logger: 'operator.HTTP.SetupCommand',
            message: 'all checks passed',
            request_id: 'req_1',
          }),
          JSON.stringify({
            severity: 'WARN',
            logger: 'operator.HTTP.LocatorPlugin',
            message: 'falling back to cached locator',
            request_id: 'req_2',
          }),
        ].join('\n'),
      })
    )

    expect(entries).toEqual([
      {
        timestamp,
        level: LogLevel.INFO,
        log: {
          level: LogLevel.INFO,
          origin: 'user',
          logger: 'operator.HTTP.SetupCommand',
          message: 'all checks passed',
          captured_by: {
            logger: 'process',
            message: 'Streaming process event',
            event_type: 'stdout',
          },
          data: {
            request_id: 'req_1',
          },
        },
      },
      {
        timestamp,
        level: LogLevel.WARN,
        log: {
          level: LogLevel.WARN,
          origin: 'user',
          logger: 'operator.HTTP.LocatorPlugin',
          message: 'falling back to cached locator',
          captured_by: {
            logger: 'process',
            message: 'Streaming process event',
            event_type: 'stdout',
          },
          data: {
            request_id: 'req_2',
          },
        },
      },
    ])
  })

  test('does not use the wrapper logger when structured data has no logger', () => {
    const [entry] = normalizeSandboxLogLineForOutput(
      timestamp,
      JSON.stringify({
        level: 'info',
        logger: 'process',
        message: 'Streaming process event',
        event_type: 'stderr',
        data: JSON.stringify({
          severity: 'WARN',
          message: 'cache warmup skipped',
          request_id: 'req_3',
        }),
      })
    )

    expect(entry).toEqual({
      timestamp,
      level: LogLevel.WARN,
      log: {
        level: LogLevel.WARN,
        origin: 'user',
        message: 'cache warmup skipped',
        captured_by: {
          logger: 'process',
          message: 'Streaming process event',
          event_type: 'stderr',
        },
        data: {
          request_id: 'req_3',
        },
      },
    })
  })

  test('keeps the outer log when data is not clean structured JSON', () => {
    const [entry] = normalizeSandboxLogLineForOutput(
      timestamp,
      JSON.stringify({
        level: 'info',
        logger: 'process',
        message: 'Streaming process event',
        data: '{"severity":"INFO"}\nnot-json',
      })
    )

    expect(entry).toEqual({
      timestamp,
      level: LogLevel.INFO,
      log: {
        level: LogLevel.INFO,
        logger: 'process',
        message: 'Streaming process event',
        data: '{"severity":"INFO"}\nnot-json',
      },
    })
  })
})
