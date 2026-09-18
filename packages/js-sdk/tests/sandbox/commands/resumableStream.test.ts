import { Code, ConnectError } from '@connectrpc/connect'
import { describe, expect, it, vi } from 'vitest'

import { CommandHandle } from '../../../src/sandbox/commands/commandHandle'
import {
  CommandOutputLostError,
  OutputPosition,
  ResumableProcessStream,
} from '../../../src/sandbox/commands/resumableStream'

const encoder = new TextEncoder()

function offsets(stdout = 0, stderr = 0, pty = 0) {
  return { stdout: BigInt(stdout), stderr: BigInt(stderr), pty: BigInt(pty) }
}

function startEvent(position: OutputPosition | undefined) {
  return {
    event: {
      event: {
        case: 'start',
        value: { pid: 1, offsets: position },
      },
    },
  }
}

function dataEvent(
  kind: 'stdout' | 'stderr' | 'pty',
  text: string,
  offset?: number
) {
  return {
    event: {
      event: {
        case: 'data',
        value: {
          output: { case: kind, value: encoder.encode(text) },
          offset: offset === undefined ? undefined : BigInt(offset),
        },
      },
    },
  }
}

function endEvent(exitCode = 0) {
  return {
    event: {
      event: {
        case: 'end',
        value: { exitCode, error: undefined },
      },
    },
  }
}

function terminated() {
  return new ConnectError('terminated', Code.Unknown)
}

// Yields `events` in order; when the last item is an Error it is thrown after
// the preceding events, standing in for the transport dropping the stream.
async function* streamOf(...events: any[]): AsyncGenerator<any> {
  for (const event of events) {
    if (event instanceof Error) {
      throw event
    }
    yield event
  }
}

async function collect(iterable: AsyncIterable<any>) {
  const seen: string[] = []
  for await (const event of iterable) {
    const e = event.event.event
    if (e.case === 'data') {
      seen.push(
        `${e.value.output.case}:${new TextDecoder().decode(e.value.output.value)}`
      )
    } else {
      seen.push(`${e.case}:${e.value.exitCode}`)
    }
  }
  return seen
}

function resumable(
  events: AsyncIterable<any>,
  connect: (resumeFrom: OutputPosition) => AsyncIterable<any>,
  overrides: Partial<
    ConstructorParameters<typeof ResumableProcessStream>[0]
  > = {}
) {
  return new ResumableProcessStream({
    events,
    offsets: offsets() as any,
    cleanup: () => {},
    connect: (resumeFrom) => connect(resumeFrom),
    timeoutMs: 0,
    backoffMs: 0,
    ...overrides,
  })
}

describe('ResumableProcessStream', () => {
  it('resumes a dropped stream from the consumed offsets without duplicates', async () => {
    const connect = vi.fn((resumeFrom: OutputPosition) =>
      streamOf(
        startEvent(resumeFrom),
        dataEvent('stdout', 'cd', 2),
        dataEvent('stderr', 'yz', 1),
        endEvent(0)
      )
    )

    const stream = resumable(
      streamOf(
        dataEvent('stdout', 'ab', 0),
        dataEvent('stderr', 'x', 0),
        terminated()
      ),
      connect
    )

    expect(await collect(stream)).toEqual([
      'stdout:ab',
      'stderr:x',
      'stdout:cd',
      'stderr:yz',
      'end:0',
    ])
    expect(connect).toHaveBeenCalledTimes(1)
    expect(connect).toHaveBeenCalledWith(offsets(2, 1, 0))
    expect(stream.consumed).toEqual(offsets(4, 3, 0))
  })

  it('tracks pty output and resumes from the consumed pty offset', async () => {
    const connect = vi.fn((resumeFrom: OutputPosition) =>
      streamOf(startEvent(resumeFrom), dataEvent('pty', 'lo', 3), endEvent(0))
    )

    const stream = resumable(
      streamOf(dataEvent('pty', 'hel', 0), terminated()),
      connect
    )

    expect(await collect(stream)).toEqual(['pty:hel', 'pty:lo', 'end:0'])
    expect(connect).toHaveBeenCalledWith(offsets(0, 0, 3))
  })

  it('starts tracking from the offsets announced by the initial start event', async () => {
    const connect = vi.fn((resumeFrom: OutputPosition) =>
      streamOf(startEvent(resumeFrom), endEvent(0))
    )

    const stream = resumable(
      streamOf(dataEvent('stdout', 'abc'), terminated()),
      connect,
      { offsets: offsets(10, 20, 0) as any }
    )

    await collect(stream)
    expect(connect).toHaveBeenCalledWith(offsets(13, 20, 0))
  })

  it('delivers the exit of a process that finished while disconnected', async () => {
    const stdout: string[] = []
    const stream = resumable(
      streamOf(dataEvent('stdout', 'partial', 0), terminated()),
      (resumeFrom) =>
        streamOf(
          startEvent(resumeFrom),
          dataEvent('stdout', ' output', 7),
          endEvent(3)
        )
    )

    const handle = new CommandHandle(
      1,
      () => stream.disconnect(),
      async () => true,
      stream,
      (data) => {
        stdout.push(data)
      }
    )

    await expect(handle.wait()).rejects.toMatchObject({
      exitCode: 3,
      stdout: 'partial output',
    })
    expect(stdout).toEqual(['partial', ' output'])
  })

  it('retries a reconnect that fails with a transient error', async () => {
    let attempts = 0
    const stream = resumable(streamOf(terminated()), (resumeFrom) => {
      attempts++
      if (attempts < 3) {
        return streamOf(new ConnectError('unavailable', Code.Unavailable))
      }
      return streamOf(startEvent(resumeFrom), endEvent(0))
    })

    expect(await collect(stream)).toEqual(['end:0'])
    expect(attempts).toBe(3)
  })

  it('surfaces the last error once the reconnect attempts are exhausted', async () => {
    const connect = vi.fn(() =>
      streamOf(new ConnectError('still down', Code.Unavailable))
    )
    const stream = resumable(streamOf(terminated()), connect, {
      maxAttempts: 2,
    })

    await expect(collect(stream)).rejects.toMatchObject({
      code: Code.Unavailable,
      rawMessage: 'still down',
    })
    expect(connect).toHaveBeenCalledTimes(2)
  })

  it('reports lost output when the replay window was exceeded', async () => {
    const stream = resumable(
      streamOf(dataEvent('stdout', 'ab', 0), terminated()),
      () => streamOf(new ConnectError('output evicted', Code.OutOfRange))
    )

    await expect(collect(stream)).rejects.toBeInstanceOf(CommandOutputLostError)
  })

  it('does not reconnect when the sandbox cannot resume streams', async () => {
    const connect = vi.fn()
    const stream = resumable(streamOf(terminated()), connect, {
      offsets: undefined,
    })

    await expect(collect(stream)).rejects.toMatchObject({
      code: Code.Unknown,
    })
    expect(connect).not.toHaveBeenCalled()
  })

  it('does not reconnect after a non-transient error', async () => {
    const connect = vi.fn()
    const stream = resumable(
      streamOf(new ConnectError('canceled', Code.Canceled)),
      connect
    )

    await expect(collect(stream)).rejects.toMatchObject({
      code: Code.Canceled,
    })
    expect(connect).not.toHaveBeenCalled()
  })

  it('does not reconnect when the sandbox is confirmed gone', async () => {
    const connect = vi.fn()
    const stream = resumable(streamOf(terminated()), connect, {
      checkHealth: async () => false,
    })

    await expect(collect(stream)).rejects.toMatchObject({
      code: Code.Unknown,
      rawMessage: 'terminated',
    })
    expect(connect).not.toHaveBeenCalled()
  })

  it('stops reconnecting once disconnected', async () => {
    const connect = vi.fn()
    const stream = resumable(streamOf(terminated()), connect, {
      backoffMs: 60_000,
    })

    const result = collect(stream)
    await new Promise((resolve) => setTimeout(resolve, 0))
    stream.disconnect()

    await expect(result).rejects.toMatchObject({ code: Code.Unknown })
    expect(connect).not.toHaveBeenCalled()
  })

  it('gives up when the stream deadline passed while disconnected', async () => {
    const connect = vi.fn()
    const stream = resumable(streamOf(terminated()), connect, {
      timeoutMs: 1,
      backoffMs: 5,
    })

    await expect(collect(stream)).rejects.toMatchObject({
      code: Code.DeadlineExceeded,
    })
    expect(connect).not.toHaveBeenCalled()
  })
})
