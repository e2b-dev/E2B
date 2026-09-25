import { create } from '@bufbuild/protobuf'
import { expect, test } from 'vitest'

import {
  EntryInfoSchema,
  FileType as FsFileType,
} from '../../../src/envd/filesystem/filesystem_pb'
import { FileType, mapEntryInfo } from '../../../src/sandbox/filesystem'

function entry(type: FsFileType, symlinkTarget?: string, isSymlink = false) {
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
    isSymlink,
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

test('mapEntryInfo reports a symlink when envd marks the entry itself as one', () => {
  // Newer envd puts the target's type in `type` and sets `isSymlink` on the link.
  const toDir = mapEntryInfo(
    entry(FsFileType.DIRECTORY, '/home/user/releases/v1', true)
  )
  expect(toDir.type).toBe(FileType.SYMLINK)
  expect(toDir.symlinkTarget).toBe('/home/user/releases/v1')
  const toFile = mapEntryInfo(entry(FsFileType.FILE, '/home/user/a.txt', true))
  expect(toFile.type).toBe(FileType.SYMLINK)
  // Without the flag the target type stands, as for a plain file or directory.
  expect(mapEntryInfo(entry(FsFileType.DIRECTORY)).type).toBe(FileType.DIR)
})
