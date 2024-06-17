import {
  createPromiseClient,
  Transport,
  PromiseClient,
  ConnectError,
  Code,
} from '@connectrpc/connect'

import {
  ConnectionConfig,
  defaultUsername,
  SandboxError,
  Username,
  ConnectionOpts,
  TimeoutError,
  InvalidUserError,
  KEEPALIVE_INTERVAL,
} from '../../connectionConfig'
import { EnvdApiClient } from '../../envd/api'
import { Filesystem as FilesystemService } from '../../envd/filesystem/filesystem_connect'
import { FileType as FsFileType, WatchDirResponse } from '../../envd/filesystem/filesystem_pb'

import { WatchHandle, FilesystemEvent } from './watchHandle'

export interface EntryInfo {
  name: string
  type: FileType
}

export const enum FileType {
  FILE = 'file',
  DIR = 'dir',
}

export interface FilesystemRequestOpts extends Partial<Pick<ConnectionOpts, 'requestTimeoutMs'>> {
  user?: Username
}

export interface WatchOpts extends FilesystemRequestOpts {
  timeout?: number
  onExit?: (err: Error) => void
}

export class FilesystemError extends SandboxError {
  constructor(message: any) {
    super(message)
    this.name = 'FilesystemError'
  }
}

export class InvalidPathError extends FilesystemError {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidPathError'
  }
}

export class NotEnoughDiskSpaceError extends FilesystemError {
  constructor(message: string) {
    super(message)
    this.name = 'NotEnoughDiskSpaceError'
  }
}

export class NotFoundError extends FilesystemError {
  constructor(message: string) {
    super(message)
    this.name = 'FileNotFoundError'
  }
}

export class Filesystem {
  private readonly rpc: PromiseClient<typeof FilesystemService>
  private readonly envdApi: EnvdApiClient

  constructor(
    transport: Transport,
    envdApiUrl: string,
    private readonly connectionConfig: ConnectionConfig,
  ) {
    this.envdApi = new EnvdApiClient({ apiUrl: envdApiUrl })
    this.rpc = createPromiseClient(FilesystemService, transport)
  }

  async read(path: string, opts?: FilesystemRequestOpts & { format?: 'text' }): Promise<string>
  async read(path: string, opts?: FilesystemRequestOpts & { format: 'bytes' }): Promise<Uint8Array>
  async read(path: string, opts?: FilesystemRequestOpts & { format: 'blob' }): Promise<Blob>
  async read(path: string, opts?: FilesystemRequestOpts & { format: 'stream' }): Promise<ReadableStream<Uint8Array>>
  async read(path: string, opts?: FilesystemRequestOpts & { format?: 'text' | 'stream' | 'bytes' | 'blob' }): Promise<unknown> {
    const format = opts?.format ?? 'text'

    const username = opts?.user || defaultUsername

    const { data, error } = await this.envdApi.api.GET('/files', {
      params: {
        query: {
          path,
          username,
        },
      },
      parseAs: format === 'bytes' ? 'arrayBuffer' : format,
      signal: this.connectionConfig.getSignal(opts?.requestTimeoutMs),
    })

    switch (error?.code) {
      case 400:
        throw new InvalidUserError(error.message)
      case 403:
        throw new InvalidPathError(error.message)
      case 404:
        throw new NotFoundError(error.message)
      default:
        if (error) {
          throw new FilesystemError(error.message)
        }
    }

    if (format === 'bytes') {
      return new Uint8Array(data as ArrayBuffer)
    }

    return data
  }

  async write(path: string, data: string | ArrayBuffer | Blob | ReadableStream, opts?: FilesystemRequestOpts): Promise<void> {
    const blob = await new Response(data).blob()

    const username = opts?.user || defaultUsername

    const { error } = await this.envdApi.api.POST('/files', {
      params: {
        query: {
          path,
          username,
        },
      },
      bodySerializer() {
        const fd = new FormData()

        fd.append('file', blob)

        return fd
      },
      body: {},
      signal: this.connectionConfig.getSignal(opts?.requestTimeoutMs),
    })

    switch (error?.code) {
      case 400:
        throw new InvalidUserError(error.message)
      case 403:
        throw new InvalidPathError(error.message)
      case 507:
        throw new NotEnoughDiskSpaceError(error.message)
      default:
        if (error) {
          throw new FilesystemError(error.message)
        }
    }
  }

  async list(path: string, opts?: FilesystemRequestOpts): Promise<EntryInfo[]> {
    const username = opts?.user || defaultUsername

    try {
      const res = await this.rpc.listDir({
        path,
        user: {
          selector: {
            case: 'username',
            value: username,
          },
        },
      }, {
        signal: this.connectionConfig.getSignal(opts?.requestTimeoutMs),
      })

      return res.entries.map(e => ({
        name: e.name,
        type: e.type === FsFileType.FILE ? FileType.FILE : FileType.DIR,
      }))
    } catch (err) {
      if (err instanceof ConnectError) {
        switch (err.code) {
          case Code.InvalidArgument:
            throw new InvalidUserError(err.message)
          case Code.NotFound:
            throw new InvalidPathError(err.message)
          case Code.DeadlineExceeded:
          case Code.Canceled:
            throw new TimeoutError(err.message)
          default:
            throw new FilesystemError(err.message)
        }
      }
      throw err
    }
  }

  async makeDir(path: string, opts?: FilesystemRequestOpts): Promise<boolean> {
    const username = opts?.user || defaultUsername

    try {
      await this.rpc.makeDir({
        path,
        user: {
          selector: {
            case: 'username',
            value: username,
          },
        },
      }, {
        signal: this.connectionConfig.getSignal(opts?.requestTimeoutMs),
      })

      return true
    } catch (err) {
      if (err instanceof ConnectError) {
        switch (err.code) {
          case Code.InvalidArgument:
            throw new InvalidUserError(err.message)
          case Code.NotFound:
            throw new InvalidPathError(err.message)
          case Code.AlreadyExists:
            return false
          case Code.FailedPrecondition:
            throw new InvalidPathError(err.message)
          case Code.DeadlineExceeded:
          case Code.Canceled:
            throw new TimeoutError(err.message)
          default:
            throw new FilesystemError(err.message)
        }
      }
      throw err
    }
  }

  async rename(oldPath: string, newPath: string, opts?: FilesystemRequestOpts): Promise<boolean> {
    const username = opts?.user || defaultUsername

    try {
      await this.rpc.move({
        source: oldPath,
        destination: newPath,
        user: {
          selector: {
            case: 'username',
            value: username,
          },
        },
      }, {
        signal: this.connectionConfig.getSignal(opts?.requestTimeoutMs),
      })

      return true
    } catch (err) {
      if (err instanceof ConnectError) {
        switch (err.code) {
          case Code.InvalidArgument:
            throw new InvalidUserError(err.message)
          case Code.NotFound:
            throw new InvalidPathError(err.message)
          case Code.DeadlineExceeded:
          case Code.Canceled:
            throw new TimeoutError(err.message)
          default:
            throw new FilesystemError(err.message)
        }
      }
      throw err
    }
  }

  async remove(path: string, opts?: FilesystemRequestOpts): Promise<void> {
    const username = opts?.user || defaultUsername

    try {
      await this.rpc.remove({
        path,
        user: {
          selector: {
            case: 'username',
            value: username,
          },
        },
      }, {
        signal: this.connectionConfig.getSignal(opts?.requestTimeoutMs),
      })
    } catch (err) {
      if (err instanceof ConnectError) {
        switch (err.code) {
          case Code.InvalidArgument:
            throw new InvalidUserError(err.message)
          case Code.NotFound:
            throw new InvalidPathError(err.message)
          case Code.DeadlineExceeded:
          case Code.Canceled:
            throw new TimeoutError(err.message)
          default:
            throw new FilesystemError(err.message)
        }
      }
      throw err
    }
  }

  async exists(path: string, opts?: FilesystemRequestOpts): Promise<boolean> {
    const username = opts?.user || defaultUsername

    try {
      await this.rpc.stat({
        path,
        user: {
          selector: {
            case: 'username',
            value: username,
          },
        },
      }, {
        signal: this.connectionConfig.getSignal(opts?.requestTimeoutMs),
      })

      return true
    } catch (err) {
      if (err instanceof ConnectError) {
        switch (err.code) {
          case Code.InvalidArgument:
            throw new InvalidUserError(err.message)
          case Code.NotFound:
            return false
          case Code.DeadlineExceeded:
          case Code.Canceled:
            throw new TimeoutError(err.message)
          default:
            throw new FilesystemError(err.message)
        }
      }
      throw err
    }
  }

  async watch(
    path: string,
    onEvent: (event: FilesystemEvent) => void | Promise<void>,
    opts?: FilesystemRequestOpts & { timeout?: number, onExit?: (err?: Error) => void | Promise<void> },
  ): Promise<WatchHandle> {
    const requestTimeoutMs = opts?.requestTimeoutMs ?? this.connectionConfig.requestTimeoutMs
    const username = opts?.user || defaultUsername

    const controller = new AbortController()

    const reqTimeout = requestTimeoutMs
      ? setTimeout(() => {
        controller.abort()
      }, requestTimeoutMs)
      : undefined

    const headers = new Headers()
    headers.set('X-Keepalive-Interval', (KEEPALIVE_INTERVAL / 1000).toString())

    const events = this.rpc.watchDir({
      path,
      user: {
        selector: {
          case: 'username',
          value: username,
        },
      },
    }, {
      headers,
      signal: controller.signal,
      timeoutMs: opts?.timeout ?? 60_000,
    })

    try {
      const startEvent: WatchDirResponse = (await events[Symbol.asyncIterator]().next()).value

      if (startEvent.event.case !== 'start') {
        throw new Error('Expected start event')
      }
    } catch (err) {
      if (err instanceof ConnectError) {
        switch (err.code) {
          case Code.InvalidArgument:
            throw new InvalidUserError(err.message)
          case Code.NotFound:
            throw new InvalidPathError(err.message)
          case Code.DeadlineExceeded:
          case Code.Canceled:
            throw new TimeoutError(err.message)
          default:
            throw new FilesystemError(err.message)
        }
      }
      throw err
    }

    clearTimeout(reqTimeout)

    return new WatchHandle(
      () => controller.abort(),
      events,
      onEvent,
      opts?.onExit,
    )
  }
}
