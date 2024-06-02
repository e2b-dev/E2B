import { PlainMessage } from '@bufbuild/protobuf'

import {
  FilesystemEvent as FsFilesystemEvent,
  EntryInfo as FsEntryInfo,
  WatchResponse,
} from '../../envd/filesystem/v1/filesystem_pb'

export type FilesystemEvent = PlainMessage<FsFilesystemEvent>
export type EntryInfo = PlainMessage<FsEntryInfo>

export class WatchHandle {
  constructor(
    private readonly handleStop: () => void,
    events: AsyncIterable<WatchResponse>,
    private readonly onEvent: (event: FilesystemEvent) => void | Promise<void>,
  ) {
    this.handleEvents(events)
  }

  stop() {
    this.handleStop()
  }

  private async handleEvents(events: AsyncIterable<WatchResponse>) {
    for await (const event of events) {
      if (event.event) {
        await this.onEvent?.(event.event)
      }
    }
  }
}
