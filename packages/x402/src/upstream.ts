/**
 * The thing this package wraps: E2B's real sandbox-creation API.
 *
 * `RealE2BUpstream` calls the exact endpoint E2B's own JS SDK calls
 * (see packages/js-sdk/src/sandbox/sandboxApi.ts::createSandbox in this repo):
 *   POST https://api.{domain}/v2/sandboxes
 *   header: X-API-KEY: <E2B_API_KEY>
 *
 * `MockUpstream` is a drop-in replacement with the same shape, used by the
 * test suite and by `pnpm dev:server --mock` so the payment-gating logic in
 * server.ts can be demoed and tested without an E2B account or API key.
 */

export interface CreateSandboxArgs {
  templateID: string
  timeoutMs?: number
}

export interface CreateSandboxResult {
  sandboxId: string
  domain?: string
  envdAccessToken?: string
}

export interface SandboxUpstream {
  createSandbox(args: CreateSandboxArgs): Promise<CreateSandboxResult>
}

export interface RealE2BUpstreamOpts {
  apiKey: string
  domain?: string // default: e2b.app (same default as the E2B SDK's ConnectionConfig)
}

export class RealE2BUpstream implements SandboxUpstream {
  private apiKey: string
  private domain: string

  constructor(opts: RealE2BUpstreamOpts) {
    this.apiKey = opts.apiKey
    this.domain = opts.domain ?? 'e2b.app'
  }

  async createSandbox(args: CreateSandboxArgs): Promise<CreateSandboxResult> {
    const res = await fetch(`https://api.${this.domain}/v2/sandboxes`, {
      method: 'POST',
      headers: {
        'X-API-KEY': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        templateID: args.templateID,
        timeout: args.timeoutMs ? Math.ceil(args.timeoutMs / 1000) : undefined,
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new Error(`E2B API error (${res.status}): ${text}`)
    }

    const data = (await res.json()) as {
      sandboxID: string
      domain?: string
      envdAccessToken?: string
    }

    return {
      sandboxId: data.sandboxID,
      domain: data.domain,
      envdAccessToken: data.envdAccessToken,
    }
  }
}

/** Local-only stand-in for RealE2BUpstream. No network call, no E2B account. */
export class MockUpstream implements SandboxUpstream {
  async createSandbox(args: CreateSandboxArgs): Promise<CreateSandboxResult> {
    return {
      sandboxId: `mock-sandbox-${args.templateID}-${Date.now()}`,
      domain: 'mock.e2b.dev',
      envdAccessToken: 'mock-envd-access-token',
    }
  }
}
