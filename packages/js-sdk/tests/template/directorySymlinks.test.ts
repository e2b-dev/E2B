import { afterEach, beforeEach, expect, test } from 'vitest'
import { createServer, type Server } from 'node:http'
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import * as tar from 'tar'
import { Template } from '../../src'

let context: string
let server: Server
let endpoint: string
let uploads: Map<string, string>[]
let hashes: string[]

beforeEach(async () => {
  context = await mkdtemp(join(tmpdir(), 'e2b-directory-links-'))
  uploads = []
  hashes = []
  server = createServer((request, response) => {
    const chunks: Buffer[] = []
    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', async () => {
      const reply = (status: number, payload: unknown) => {
        response.writeHead(status, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify(payload))
      }
      if (request.method === 'PUT' && request.url === '/upload') {
        const members = new Map<string, string>()
        const parser = tar.list({
          onentry: (entry) => {
            members.set(entry.path.replace(/\/$/, ''), entry.type)
          },
        })
        await new Promise<void>((resolve, reject) => {
          parser.on('end', resolve)
          parser.on('error', reject)
          parser.end(Buffer.concat(chunks))
        })
        uploads.push(members)
        reply(200, {})
      } else if (request.url === '/v3/templates') {
        reply(202, {
          templateID: 'fixture',
          buildID: 'build',
          public: false,
          names: [],
          tags: [],
          aliases: [],
        })
      } else if (request.url?.startsWith('/templates/fixture/files/')) {
        hashes.push(request.url.split('/').at(-1)!)
        reply(201, { present: false, url: `${endpoint}/upload` })
      } else if (request.url === '/v2/templates/fixture/builds/build') {
        reply(202, {})
      } else {
        reply(404, {})
      }
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()))
  await rm(context, { recursive: true, force: true })
})

test.skipIf(process.platform === 'win32').each([true, false])(
  'build copies a directory symlink with resolveSymlinks=%s',
  async (resolveSymlinks) => {
    await mkdir(join(context, 'real'))
    await writeFile(join(context, 'real/app.py'), "print('hello')")
    await symlink('real', join(context, 'linked'))
    const template = new Template({ fileContextPath: context })
      .fromPythonImage('3')
      .copy('linked', '/app', { resolveSymlinks })
    await Template.buildInBackground(template, 'fixture', {
      apiKey: 'fixture-placeholder',
      apiUrl: endpoint,
    })
    expect(uploads.at(-1)).toEqual(
      new Map(
        resolveSymlinks
          ? [
              ['linked', 'Directory'],
              ['linked/app.py', 'File'],
            ]
          : [['linked', 'SymbolicLink']]
      )
    )
  }
)

test.skipIf(process.platform === 'win32').each(['linked', 'real'])(
  'build hashes resolved descendants and honors ignore rules for %s',
  async (source) => {
    await mkdir(join(context, 'real'))
    await mkdir(join(context, 'other'))
    await writeFile(join(context, 'other/app.py'), 'first')
    await writeFile(join(context, 'other/.env'), 'synthetic-secret')
    await symlink('real', join(context, 'linked'))
    await symlink('../other', join(context, 'real/nested'))
    await symlink('../other', join(context, 'real/again'))
    const build = () =>
      Template.buildInBackground(
        new Template({
          fileContextPath: context,
          fileIgnorePatterns: [`${source}/nested/.env`, `${source}/again/.env`],
        })
          .fromPythonImage('3')
          .copy(source, '/app', { resolveSymlinks: true }),
        'fixture',
        { apiKey: 'fixture-placeholder', apiUrl: endpoint }
      )
    await build()
    expect(uploads.at(-1)?.get(`${source}/nested/app.py`)).toBe('File')
    expect(uploads.at(-1)?.get(`${source}/again/app.py`)).toBe('File')
    expect(
      [...uploads.at(-1)!.keys()].some((name) => name.endsWith('.env'))
    ).toBe(false)
    await writeFile(join(context, 'other/.env'), 'a-longer-synthetic-secret')
    await build()
    expect(hashes.at(-1)).toBe(hashes.at(-2))
    await writeFile(join(context, 'other/app.py'), 'other')
    await build()
    expect(hashes.at(-1)).not.toBe(hashes.at(-2))
  }
)

test.skipIf(process.platform === 'win32')(
  'build reports cyclic directory symlinks',
  async () => {
    await mkdir(join(context, 'real'))
    await symlink('.', join(context, 'real/back'))
    const template = new Template({ fileContextPath: context })
      .fromPythonImage('3')
      .copy('real', '/app', { resolveSymlinks: true })
    await expect(
      Template.buildInBackground(template, 'fixture', {
        apiKey: 'fixture-placeholder',
        apiUrl: endpoint,
      })
    ).rejects.toThrow('cyclic directory symlink')
  }
)

test.skipIf(process.platform === 'win32')(
  'build detects cycles through ignored ancestors',
  async () => {
    await mkdir(join(context, 'real/ignored'), { recursive: true })
    await symlink('..', join(context, 'real/ignored/back'))
    const template = new Template({
      fileContextPath: context,
      fileIgnorePatterns: ['**/ignored', '!**/back'],
    })
      .fromPythonImage('3')
      .copy('real', '/app', { resolveSymlinks: true })
    await expect(
      Template.buildInBackground(template, 'fixture', {
        apiKey: 'fixture-placeholder',
        apiUrl: endpoint,
      })
    ).rejects.toThrow('cyclic directory symlink')
  }
)

test.skipIf(process.platform === 'win32')(
  'build reincludes children under an ignored directory link',
  async () => {
    await mkdir(join(context, 'real'))
    await mkdir(join(context, 'target'))
    await writeFile(join(context, 'target/keep.txt'), 'keep')
    await writeFile(join(context, 'target/skip.txt'), 'skip')
    await symlink('../target', join(context, 'real/link'))
    const build = () =>
      Template.buildInBackground(
        new Template({
          fileContextPath: context,
          fileIgnorePatterns: ['target', 'real/link', '!real/link/keep.txt'],
        })
          .fromPythonImage('3')
          .copy('.', '/app', { resolveSymlinks: true }),
        'fixture',
        { apiKey: 'fixture-placeholder', apiUrl: endpoint }
      )
    await build()
    expect(uploads.at(-1)?.get('real/link/keep.txt')).toBe('File')
    expect(uploads.at(-1)?.has('real/link')).toBe(false)
    expect(uploads.at(-1)?.has('real/link/skip.txt')).toBe(false)
    await writeFile(join(context, 'target/keep.txt'), 'edit')
    await build()
    expect(hashes.at(-1)).not.toBe(hashes.at(-2))
    await writeFile(join(context, 'target/skip.txt'), 'ignored edit')
    await build()
    expect(hashes.at(-1)).toBe(hashes.at(-2))
  }
)

test.skipIf(process.platform === 'win32')(
  'build resolves matched link names as literal paths',
  async () => {
    await mkdir(join(context, 'real'))
    await mkdir(join(context, 'alias1'))
    await writeFile(join(context, 'real/app.py'), 'correct')
    await writeFile(join(context, 'alias1/wrong.txt'), 'other directory')
    await symlink('real', join(context, 'alias[1]'))
    const template = new Template({ fileContextPath: context })
      .fromPythonImage('3')
      .copy('*', '/app', { resolveSymlinks: true })
    await Template.buildInBackground(template, 'fixture', {
      apiKey: 'fixture-placeholder',
      apiUrl: endpoint,
    })
    expect(uploads.at(-1)?.get('alias[1]/app.py')).toBe('File')
    expect(uploads.at(-1)?.get('alias[1]/wrong.txt')).toBeUndefined()
  }
)

test.skipIf(process.platform === 'win32').each([
  [true, 'directory'],
  [false, 'directory'],
  [true, 'nested_file'],
  [false, 'nested_file'],
] as const)(
  'build keeps resolved link targets within the context: %s %s',
  async (resolveSymlinks, targetKind) => {
    const outside = await mkdtemp(join(tmpdir(), 'e2b-outside-link-'))
    try {
      await writeFile(join(outside, 'synthetic.txt'), 'outside fixture')
      if (targetKind === 'directory') {
        await symlink(outside, join(context, 'linked'))
      } else {
        await mkdir(join(context, 'real'))
        await symlink(
          join(outside, 'synthetic.txt'),
          join(context, 'real/external.txt')
        )
        await symlink('real', join(context, 'linked'))
      }
      const template = new Template({ fileContextPath: context })
        .fromPythonImage('3')
        .copy('linked', '/app', { resolveSymlinks })
      const result = Template.buildInBackground(template, 'fixture', {
        apiKey: 'fixture-placeholder',
        apiUrl: endpoint,
      })
      if (resolveSymlinks) {
        await expect(result).rejects.toThrow(/outside.*context/)
        expect(uploads).toHaveLength(0)
      } else {
        await result
        expect(uploads.at(-1)).toEqual(new Map([['linked', 'SymbolicLink']]))
      }
    } finally {
      await rm(outside, { recursive: true, force: true })
    }
  }
)

test.skipIf(process.platform === 'win32')(
  'build link error preserves the copy callsite',
  async () => {
    await mkdir(join(context, 'real'))
    await symlink('.', join(context, 'real/back'))
    function copyWithCyclicLink() {
      return new Template({ fileContextPath: context })
        .fromPythonImage('3')
        .copy('real', '/app', { resolveSymlinks: true })
    }
    const template = copyWithCyclicLink()
    await expect(
      Template.buildInBackground(template, 'fixture', {
        apiKey: 'fixture-placeholder',
        apiUrl: endpoint,
      })
    ).rejects.toMatchObject({
      name: 'BuildError',
      message: expect.stringContaining('resolveSymlinks: false'),
      stack: expect.stringContaining('copyWithCyclicLink'),
    })
  }
)
