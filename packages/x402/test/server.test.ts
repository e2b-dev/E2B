import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Server } from 'node:http'
import { createPaidSandboxApp } from '../src/server.js'
import { MockUpstream } from '../src/upstream.js'
import { startMockFacilitator } from '../src/mockFacilitator.mjs'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { x402Client, wrapFetchWithPayment } from '@x402/fetch'
import { ExactEvmScheme } from '@x402/evm/exact/client'

// A freshly generated, unfunded, throwaway EVM keypair used only to produce a
// structurally valid x402 payment signature against our own localhost mock
// facilitator (which accepts any payload). No real network, no real funds.
const PAY_TO = '0x6F388B8629D3BE977EFa43Cb581845C8642cf5f8' as const
const NETWORK = 'eip155:84532'

let facilitator: Server
let sandboxServer: Server
let baseUrl: string

beforeAll(async () => {
  facilitator = (await startMockFacilitator(0)) as unknown as Server
  const facilitatorAddr = facilitator.address()
  const facilitatorPort = typeof facilitatorAddr === 'object' && facilitatorAddr ? facilitatorAddr.port : 4099
  const facilitatorUrl = `http://localhost:${facilitatorPort}`

  const app = createPaidSandboxApp({
    upstream: new MockUpstream(),
    payTo: PAY_TO,
    facilitatorUrl,
    network: NETWORK,
    pricePerSandbox: '$0.05',
  })

  await new Promise<void>((resolve) => {
    sandboxServer = app.listen(0, resolve)
  })
  const addr = sandboxServer.address()
  const port = typeof addr === 'object' && addr ? addr.port : 4022
  baseUrl = `http://localhost:${port}`
})

afterAll(() => {
  sandboxServer?.close()
  facilitator?.close()
})

describe('@e2b/x402 createPaidSandboxApp', () => {
  it('answers health checks without payment', async () => {
    const res = await fetch(`${baseUrl}/health`)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'ok' })
  })

  it('returns HTTP 402 with correct payment requirements when unpaid', async () => {
    const res = await fetch(`${baseUrl}/sandbox`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateID: 'base' }),
    })
    expect(res.status).toBe(402)
    // Payment requirements ride in the `payment-required` header, base64-encoded JSON
    // (the x402 spec's standard 402 response shape; the JSON body is empty).
    const header = res.headers.get('payment-required')
    expect(header).toBeTruthy()
    const decoded = JSON.parse(Buffer.from(header!, 'base64').toString('utf-8'))
    expect(decoded.accepts[0]).toMatchObject({
      scheme: 'exact',
      network: NETWORK,
      payTo: PAY_TO,
    })
  })

  it('creates a sandbox once a valid x402 payment is presented', async () => {
    const signer = privateKeyToAccount(generatePrivateKey())
    const client = new x402Client()
    client.register(NETWORK, new ExactEvmScheme(signer))
    const fetchWithPayment = wrapFetchWithPayment(fetch, client)

    const res = await fetchWithPayment(`${baseUrl}/sandbox`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateID: 'base' }),
    })

    expect(res.status).toBe(200)
    const sandbox = await res.json()
    expect(sandbox.sandboxId).toMatch(/^mock-sandbox-base-/)
    expect(sandbox.domain).toBe('mock.e2b.dev')
  })
})
