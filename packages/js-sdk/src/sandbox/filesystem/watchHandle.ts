import { PlainMessage } from '@bufbuild/protobuf'

import {
  FilesystemEvent as FsFilesystemEvent,
  EntryInfo as FsEntryInfo,
  WatchResponse,
} from '../../envd/filesystem/filesystem_pb'

export type FilesystemEvent = PlainMessage<FsFilesystemEvent>
export type EntryInfo = PlainMessage<FsEntryInfo>

export class WatchHandle {
  constructor(
    private readonly handleStop: () => void,
    private readonly events: AsyncIterable<WatchResponse>,
    private readonly onEvent?: (event: FilesystemEvent) => void | Promise<void>,
    iterator?: boolean,
  ) {
    if (!iterator) {
      this.handleEvents()
    }
  }

  stop() {
    this.handleStop()
  }

  async *[Symbol.asyncIterator]() {
    try {
      for await (const event of this.events) {
        if (event.event) {
          yield event.event
        }
      }
    } finally {
      this.stop()
    }
  }

  private async handleEvents() {
    for await (const event of this) {
      this.onEvent?.(event)
    }
  }
}
