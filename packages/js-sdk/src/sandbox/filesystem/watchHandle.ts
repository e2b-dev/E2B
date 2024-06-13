import { PlainMessage } from '@bufbuild/protobuf'
import { ConnectError } from '@connectrpc/connect'
import { FilesystemError } from '.'

import {
  WatchDirResponse, WatchDirResponse_FilesystemEvent,
} from '../../envd/filesystem/filesystem_pb'

export type FilesystemEvent = PlainMessage<WatchDirResponse_FilesystemEvent>

export class WatchHandle {
  private readonly _wait: Promise<void>

  constructor(
    private readonly handleStop: () => void,
    private readonly events: AsyncIterable<WatchDirResponse>,
    private readonly onEvent?: (event: FilesystemEvent) => void | Promise<void>,
    private readonly onExit?: (err?: Error) => void | Promise<void>,
  ) {
    this._wait = this.handleEvents()
  }

  async stop() {
    this.handleStop()

    await this._wait
  }

  private async* iterateEvents() {
    try {
      for await (const event of this.events) {
        switch (event.event.case) {
          case 'filesystem':
            yield event.event
            break
          default:
            throw new Error(`Unknown event type: ${event.event.case}`)
        }
      }
    } catch (err) {
      if (err instanceof ConnectError) {
        switch (err.code) {
          default:
            throw new FilesystemError(err.message)
        }
      }
      throw err
    } finally {
      this.stop()
    }
  }

  private async handleEvents() {
    try {
      for await (const event of this.iterateEvents()) {
        this.onEvent?.(event.value)
      }
      this.onExit?.()
    } catch (err) {
      this.onExit?.(err as Error)
    }
  }
}
