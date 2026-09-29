// Fully local, offline test double for an x402 facilitator.
// It never touches a real chain, never holds keys, and never verifies a real
// signature — it exists ONLY so createPaidSandboxApp can be demoed and
// tested end-to-end (402 -> "payment" -> 200 with a real/mock sandbox)
// without any real wallet, signature, or on-chain transaction.
//
// To go live, point facilitatorUrl at a real facilitator instead, e.g.
// https://x402.org/facilitator (Base Sepolia testnet) or Coinbase CDP's
// facilitator for mainnet — that step is intentionally NOT performed here.
import http from 'node:http'

export function startMockFacilitator(port = 4099) {
  const NETWORK = 'eip155:84532'

  function json(res, status, body) {
    const buf = JSON.stringify(body)
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(buf),
    })
    res.end(buf)
  }

  function readBody(req) {
    return new Promise((resolve) => {
      let data = ''
      req.on('data', (c) => (data += c))
      req.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : {})
        } catch {
          resolve({})
        }
      })
    })
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${port}`)

    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { status: 'ok', mode: 'mock-local-only' })
    }

    if (req.method === 'GET' && url.pathname === '/supported') {
      return json(res, 200, {
        kinds: [
          { x402Version: 2, scheme: 'exact', network: NETWORK },
          { x402Version: 1, scheme: 'exact', network: NETWORK },
        ],
        extensions: [],
        signers: { 'eip155:*': ['0x0000000000000000000000000000000000000000'] },
      })
    }

    // Accepts ANY payment payload as valid. This mock exists to test the
    // resource server's gating logic, not x402's own signature verification
    // (which is Coinbase's code, already tested upstream).
    if (req.method === 'POST' && url.pathname === '/verify') {
      const body = await readBody(req)
      return json(res, 200, {
        isValid: true,
        invalidReason: null,
        payer: body?.paymentPayload?.payload?.authorization?.from || '0xmockpayer',
      })
    }

    if (req.method === 'POST' && url.pathname === '/settle') {
      const body = await readBody(req)
      return json(res, 200, {
        success: true,
        transaction: '0x' + 'mock'.padEnd(64, '0'),
        network: NETWORK,
        payer: body?.paymentPayload?.payload?.authorization?.from || '0xmockpayer',
      })
    }

    return json(res, 404, { error: 'not found' })
  })

  return new Promise((resolve) => {
    server.listen(port, () => resolve(server))
  })
}

// Allow running directly: `node src/mockFacilitator.mjs [port]`
if (import.meta.url === `file://${process.argv[1]}`) {
  const port = parseInt(process.argv[2] || '4099', 10)
  startMockFacilitator(port).then(() => {
    console.log(`[mock-facilitator] listening on http://localhost:${port} (offline, no real chain, no real keys)`)
  })
}
