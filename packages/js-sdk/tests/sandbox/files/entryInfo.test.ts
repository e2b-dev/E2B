import { create } from '@bufbuild/protobuf'
import { expect, test } from 'vitest'

import {
  EntryInfoSchema,
  FileType as FsFileType,
} from '../../../src/envd/filesystem/filesystem_pb'
import { FileType, mapEntryInfo } from '../../../src/sandbox/filesystem'

function entry(type: FsFileType, symlinkTarget?: string) {
  return create(EntryInfoSchema, {
    name: 'entry',
    type,
    path: '/home/user/entry',
    size: BigInt(0),
    mode: 0o644,
    permissions: '-rw-r--r--',
    owner: 'user',
    group: 'user',
    symlinkTarget,
  })
}

test('mapEntryInfo maps every known protobuf file type to the public enum', () => {
  expect(mapEntryInfo(entry(FsFileType.FILE)).type).toBe(FileType.FILE)
  expect(mapEntryInfo(entry(FsFileType.DIRECTORY)).type).toBe(FileType.DIR)
  expect(mapEntryInfo(entry(FsFileType.SYMLINK)).type).toBe(FileType.SYMLINK)
})

test('mapEntryInfo keeps the symlink target on symlink entries', () => {
  const info = mapEntryInfo(entry(FsFileType.SYMLINK, '/home/user/a.txt'))
  expect(info.type).toBe(FileType.SYMLINK)
  expect(info.symlinkTarget).toBe('/home/user/a.txt')
})
