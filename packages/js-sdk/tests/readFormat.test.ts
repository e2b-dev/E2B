import { expect, test, vi } from 'vitest'
import type { Transport } from '@connectrpc/connect'

import { Filesystem } from '../src/sandbox/filesystem'
import { ConnectionConfig } from '../src/connectionConfig'
import { InvalidArgumentError, Volume } from '../src'
import type { EnvdApiClient } from '../src/envd/api'

function stubFilesystem() {
  const get = vi.fn(() => {
    throw new Error('GET should not be called')
  })
  const envdApi = {
    version: '1.0.0',
    api: { GET: get },
  } as unknown as EnvdApiClient
  const fs = new Filesystem(
    {} as Transport,
    envdApi,
    new ConnectionConfig({ apiKey: 'e2b_' + '0'.repeat(40) })
  )
  return { fs, get }
}

test('files.read throws InvalidArgumentError on an unrecognized format', async () => {
  const { fs, get } = stubFilesystem()
  await expect(fs.read('/tmp/x', { format: 'Text' as never })).rejects.toThrow(
    InvalidArgumentError
  )
  expect(get).not.toHaveBeenCalled()
})

test('files.read throws InvalidArgumentError on an explicit null format', async () => {
  const { fs, get } = stubFilesystem()
  await expect(fs.read('/tmp/x', { format: null as never })).rejects.toThrow(
    InvalidArgumentError
  )
  expect(get).not.toHaveBeenCalled()
})

test('volume.readFile throws InvalidArgumentError on an unrecognized format', async () => {
  const vol = new Volume('vol-id', 'name', 'tok')
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
    throw new Error('GET should not be called')
  })
  await expect(vol.readFile('/x', { format: 'Text' as never })).rejects.toThrow(
    InvalidArgumentError
  )
  expect(fetchSpy).not.toHaveBeenCalled()
  fetchSpy.mockRestore()
})

test('volume.readFile throws InvalidArgumentError on an explicit null format', async () => {
  const vol = new Volume('vol-id', 'name', 'tok')
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
    throw new Error('GET should not be called')
  })
  await expect(vol.readFile('/x', { format: null as never })).rejects.toThrow(
    InvalidArgumentError
  )
  expect(fetchSpy).not.toHaveBeenCalled()
  fetchSpy.mockRestore()
})
