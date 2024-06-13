import { PlainMessage } from '@bufbuild/protobuf'
import { ConnectError, Code } from '@connectrpc/connect'
import { FilesystemError, InvalidUserError, NotFoundError } from '.'

import {
  FilesystemEvent as FsFilesystemEvent,
  EntryInfo as FsEntryInfo,
  WatchDirResponse,
} from '../../envd/filesystem/filesystem_pb'

export type FilesystemEvent = PlainMessage<FsFilesystemEvent>
export type EntryInfo = PlainMessage<FsEntryInfo>

export class WatchHandle {
  private readonly _wait: Promise<void>

  constructor(
    private readonly handleStop: () => void,
    private readonly events: AsyncIterable<WatchDirResponse>,
    private readonly path: string,
    private readonly username: string,
    private readonly onEvent?: (event: FilesystemEvent) => void | Promise<void>,
    private readonly onExit?: (err?: Error) => void | Promise<void>,
  ) {
    this._wait = this.handleEvents()
  }

  stop() {
    this.handleStop()
  }

  async wait() {
    await this._wait
  }

  private async *[Symbol.asyncIterator]() {
    try {
      for await (const event of this.events) {
        if (event.event) {
          yield event.event
        }
      }
    } catch (err) {
      if (err instanceof ConnectError) {
        switch (err.code) {
          case Code.InvalidArgument:
            throw new InvalidUserError(err.message, this.username)
          case Code.NotFound:
            throw new NotFoundError(err.message, this.path)
          default:
            throw new FilesystemError(err.message)
        }
      }
      throw err
    } finally {
      this.onExit?.()
      this.stop()
    }
  }

  private async handleEvents() {
    for await (const event of this) {
      this.onEvent?.(event)
    }
  }
}
