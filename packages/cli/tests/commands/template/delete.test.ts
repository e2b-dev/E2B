import { createServer, Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { runCliWithPipedStdin } from '../../setup'

let server: Server
let apiUrl: string
const templates = new Set<string>()
const deleteRequests: string[] = []

beforeAll(async () => {
  server = createServer((req, res) => {
    const match = req.url?.match(/^\/templates\/([^/?]+)$/)
    if (req.method !== 'DELETE' || !match) {
      res.statusCode = 500
      res.end()
      return
    }

    const templateID = decodeURIComponent(match[1])
    deleteRequests.push(templateID)
    if (!templates.delete(templateID)) {
      res.statusCode = 404
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ code: 404, message: 'template not found' }))
      return
    }
    res.statusCode = 204
    res.end()
  })
  await new Promise<void>((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve())
  )
  const { port } = server.address() as AddressInfo
  apiUrl = `http://127.0.0.1:${port}`
})

afterAll(() => {
  server.close()
})

function deleteTemplate(template: string) {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    E2B_API_URL: apiUrl,
    E2B_API_KEY: `e2b_${'0'.repeat(40)}`,
  }
  delete env.E2B_DEBUG

  return runCliWithPipedStdin(
    ['template', 'delete', template, '--yes'],
    Buffer.alloc(0),
    { timeoutMs: 30_000, env }
  )
}

describe('template delete', () => {
  test('deletes the template, then reports it missing', async () => {
    templates.add('demo')

    const deleted = await deleteTemplate('demo')
    expect(deleted.error).toBeUndefined()
    expect(deleted.status, deleted.stderr.toString()).toBe(0)
    expect(deleted.stdout.toString()).toContain(
      '- Deleting sandbox template demo'
    )
    expect(templates.has('demo')).toBe(false)

    const missing = await deleteTemplate('demo')
    expect(missing.status).toBe(1)
    expect(missing.stderr.toString()).toContain(
      'Sandbox template demo not found'
    )

    expect(deleteRequests).toEqual(['demo', 'demo'])
  })
})
