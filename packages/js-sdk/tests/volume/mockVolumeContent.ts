import { http, HttpResponse } from 'msw'
import { randomUUID } from 'node:crypto'

import { VolumeFileType } from '../../src'
import { apiUrl } from '../setup'

/**
 * In-memory mock of the volume control-plane CRUD plus the volume content API
 * (spec/openapi-volumecontent.yml), backing the `volumeTest` file-operation
 * tests with a stateful in-process filesystem.
 */

const DEFAULT_FILE_MODE = 0o644
const DEFAULT_DIR_MODE = 0o755

interface Entry {
  name: string
  type: VolumeFileType
  path: string
  uid: number
  gid: number
  mode: number
  content: Uint8Array
  timestamp: string
}

function normalize(path: string): string {
  let normalized = path.trim()
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`
  }
  // Collapse repeated slashes and strip a trailing slash (except for root).
  normalized = normalized.replace(/\/+/g, '/')
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }
  return normalized
}

function dirname(path: string): string {
  const idx = path.lastIndexOf('/')
  return idx <= 0 ? '/' : path.slice(0, idx)
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

function makeEntry(
  path: string,
  type: Entry['type'],
  params: URLSearchParams,
  content: Uint8Array = new Uint8Array()
): Entry {
  const mode = params.get('mode')
  return {
    name: basename(path),
    type,
    path,
    uid: Number(params.get('uid') ?? 0),
    gid: Number(params.get('gid') ?? 0),
    mode:
      mode !== null
        ? Number(mode)
        : type === VolumeFileType.FILE
          ? DEFAULT_FILE_MODE
          : DEFAULT_DIR_MODE,
    content,
    timestamp: new Date().toISOString(),
  }
}

function stat(entry: Entry) {
  return {
    name: entry.name,
    type: entry.type,
    path: entry.path,
    size: entry.content.length,
    mode: entry.mode,
    uid: entry.uid,
    gid: entry.gid,
    atime: entry.timestamp,
    mtime: entry.timestamp,
    ctime: entry.timestamp,
  }
}

function error(status: number, message: string) {
  return HttpResponse.json({ code: String(status), message }, { status })
}

function makeDir(
  fs: Map<string, Entry>,
  path: string,
  params: URLSearchParams
) {
  const force = params.get('force') === 'true'
  const existing = fs.get(path)
  if (existing) {
    if (!force || existing.type !== VolumeFileType.DIRECTORY) {
      return error(409, `Path ${path} already exists`)
    }
    return HttpResponse.json(stat(existing), { status: 201 })
  }

  const parentPath = dirname(path)
  const parent = fs.get(parentPath)
  if (!parent) {
    if (!force) {
      return error(404, `Path ${parentPath} not found`)
    }
    const res = makeDir(fs, parentPath, params)
    if (res.status >= 400) {
      return res
    }
  } else if (parent.type !== VolumeFileType.DIRECTORY) {
    return error(409, `Path ${parentPath} is not a directory`)
  }

  const entry = makeEntry(path, VolumeFileType.DIRECTORY, params)
  fs.set(path, entry)
  return HttpResponse.json(stat(entry), { status: 201 })
}

/**
 * Per-instance mock of the volume control-plane CRUD plus the volume content
 * API. Create a fresh instance per test to get isolated state, mirroring the
 * per-fixture `MockVolumeContentAPI` in the Python SDK tests.
 */
export function createMockVolumeApi() {
  // Volumes created via the control-plane mock, keyed by volume ID.
  const volumes = new Map<
    string,
    { volumeID: string; name: string; token: string }
  >()

  // One in-memory filesystem per volume, keyed by volume ID.
  const filesystems = new Map<string, Map<string, Entry>>()

  function getFs(volumeID: string): Map<string, Entry> {
    let fs = filesystems.get(volumeID)
    if (!fs) {
      fs = new Map([
        ['/', makeEntry('/', VolumeFileType.DIRECTORY, new URLSearchParams())],
      ])
      filesystems.set(volumeID, fs)
    }
    return fs
  }

  return [
    // Control-plane volume CRUD used by the `volumeTest` fixture.
    http.post(apiUrl('/volumes'), async ({ request }) => {
      const { name } = (await request.clone().json()) as { name: string }
      const volumeID = randomUUID()
      const token = `vol-token-${randomUUID()}`
      volumes.set(volumeID, { volumeID, name, token })
      return HttpResponse.json({ volumeID, name, token }, { status: 201 })
    }),

    http.delete<{ volumeID: string }>(
      apiUrl('/volumes/:volumeID'),
      ({ params }) => {
        const existed = volumes.delete(params.volumeID)
        filesystems.delete(params.volumeID)
        if (!existed) {
          return error(404, 'Not found')
        }
        return new HttpResponse(null, { status: 204 })
      }
    ),

    // Volume content API.
    http.put<{ volumeID: string }>(
      apiUrl('/volumecontent/:volumeID/file'),
      async ({ params, request }) => {
        const fs = getFs(params.volumeID)
        const query = new URL(request.url).searchParams
        const path = normalize(query.get('path') ?? '')

        const existing = fs.get(path)
        if (existing) {
          if (existing.type !== VolumeFileType.FILE) {
            return error(409, `Path ${path} is a directory`)
          }
          if (query.get('force') !== 'true') {
            return error(409, `Path ${path} already exists`)
          }
        }

        const parent = fs.get(dirname(path))
        if (!parent || parent.type !== VolumeFileType.DIRECTORY) {
          return error(404, `Path ${path} not found`)
        }

        const content = new Uint8Array(await request.arrayBuffer())
        const entry = makeEntry(path, VolumeFileType.FILE, query, content)
        fs.set(path, entry)
        return HttpResponse.json(stat(entry), { status: 201 })
      }
    ),

    http.get<{ volumeID: string }>(
      apiUrl('/volumecontent/:volumeID/file'),
      ({ params, request }) => {
        const fs = getFs(params.volumeID)
        const path = normalize(
          new URL(request.url).searchParams.get('path') ?? ''
        )
        const entry = fs.get(path)
        if (!entry || entry.type !== VolumeFileType.FILE) {
          return error(404, `Path ${path} not found`)
        }
        return new HttpResponse(
          entry.content.length > 0 ? entry.content.slice().buffer : null,
          {
            status: 200,
            headers: {
              'Content-Type': 'application/octet-stream',
              'Content-Length': String(entry.content.length),
            },
          }
        )
      }
    ),

    http.get<{ volumeID: string }>(
      apiUrl('/volumecontent/:volumeID/dir'),
      ({ params, request }) => {
        const fs = getFs(params.volumeID)
        const path = normalize(
          new URL(request.url).searchParams.get('path') ?? ''
        )
        const entry = fs.get(path)
        if (!entry || entry.type !== VolumeFileType.DIRECTORY) {
          return error(404, `Path ${path} not found`)
        }
        const prefix = path === '/' ? '/' : `${path}/`
        const children = Array.from(fs.entries())
          .filter(
            ([p]) =>
              p !== path &&
              p.startsWith(prefix) &&
              !p.slice(prefix.length).includes('/')
          )
          .map(([, e]) => stat(e))
        return HttpResponse.json(children)
      }
    ),

    http.post<{ volumeID: string }>(
      apiUrl('/volumecontent/:volumeID/dir'),
      ({ params, request }) => {
        const fs = getFs(params.volumeID)
        const query = new URL(request.url).searchParams
        const path = normalize(query.get('path') ?? '')
        return makeDir(fs, path, query)
      }
    ),

    http.get<{ volumeID: string }>(
      apiUrl('/volumecontent/:volumeID/path'),
      ({ params, request }) => {
        const fs = getFs(params.volumeID)
        const path = normalize(
          new URL(request.url).searchParams.get('path') ?? ''
        )
        const entry = fs.get(path)
        if (!entry) {
          return error(404, `Path ${path} not found`)
        }
        return HttpResponse.json(stat(entry))
      }
    ),

    http.patch<{ volumeID: string }>(
      apiUrl('/volumecontent/:volumeID/path'),
      async ({ params, request }) => {
        const fs = getFs(params.volumeID)
        const path = normalize(
          new URL(request.url).searchParams.get('path') ?? ''
        )
        const entry = fs.get(path)
        if (!entry) {
          return error(404, `Path ${path} not found`)
        }
        const body = (await request.clone().json()) as {
          uid?: number
          gid?: number
          mode?: number
        }
        if (body.uid !== undefined) entry.uid = body.uid
        if (body.gid !== undefined) entry.gid = body.gid
        if (body.mode !== undefined) entry.mode = body.mode
        return HttpResponse.json(stat(entry))
      }
    ),

    http.delete<{ volumeID: string }>(
      apiUrl('/volumecontent/:volumeID/path'),
      ({ params, request }) => {
        const fs = getFs(params.volumeID)
        const path = normalize(
          new URL(request.url).searchParams.get('path') ?? ''
        )
        if (path === '/' || !fs.has(path)) {
          return error(404, `Path ${path} not found`)
        }
        const prefix = `${path}/`
        for (const p of Array.from(fs.keys())) {
          if (p === path || p.startsWith(prefix)) {
            fs.delete(p)
          }
        }
        return new HttpResponse(null, { status: 204 })
      }
    ),
  ]
}
