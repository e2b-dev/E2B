# e2b

## 2.41.0

### Minor Changes

- 6824cdf: Add `network.egressProxy` / `network["egress_proxy"]` for routing a sandbox's outbound TCP through a SOCKS5 proxy you operate ("bring your own proxy"). Tunneling happens on the host after the `allowOut` / `denyOut` lists are evaluated, so nothing runs inside the sandbox and code running there can neither see the proxy nor route around it. UDP-based traffic — DNS and QUIC/HTTP3 — is not tunneled.

  ```ts
  import { Sandbox } from 'e2b'

  const sandbox = await Sandbox.create({
    network: {
      egressProxy: {
        address: 'proxy.example.com:1080',
        username: 'proxy-user',
        password: 'proxy-password',
      },
    },
  })
  ```

  ```python
  from e2b import Sandbox

  sandbox = Sandbox.create(
      network={
          "egress_proxy": {
              "address": "proxy.example.com:1080",
              "username": "proxy-user",
              "password": "proxy-password",
          },
      },
  )
  ```

  It combines with the rest of the network configuration — here everything except `api.example.com` is denied, and the traffic that is allowed goes through your proxy:

  ```ts
  await Sandbox.create({
    network: {
      allowOut: ['api.example.com'],
      denyOut: ({ allTraffic }) => [allTraffic],
      egressProxy: { address: 'proxy.example.com:1080' },
    },
  })
  ```

  ```python
  Sandbox.create(
      network={
          "allow_out": ["api.example.com"],
          "deny_out": lambda ctx: [ctx.all_traffic],
          "egress_proxy": {"address": "proxy.example.com:1080"},
      },
  )
  ```

  `updateNetwork` / `update_network` sets or replaces the proxy on a sandbox that is already running, with no restart. The update replaces the whole configuration instead of merging into it, so an update that leaves the proxy out stops tunneling — repeat it in every update that should keep it.

  ```ts
  // Start tunneling on the running sandbox
  await sandbox.updateNetwork({
    allowOut: ['api.example.com'],
    denyOut: ({ allTraffic }) => [allTraffic],
    egressProxy: { address: 'proxy.example.com:1080' },
  })

  // Stop tunneling: an update without egressProxy clears it
  await sandbox.updateNetwork({})
  ```

  ```python
  # Start tunneling on the running sandbox
  sandbox.update_network({
      "allow_out": ["api.example.com"],
      "deny_out": lambda ctx: [ctx.all_traffic],
      "egress_proxy": {"address": "proxy.example.com:1080"},
  })

  # Stop tunneling: an update without egress_proxy clears it
  sandbox.update_network({})
  ```

  `getInfo` / `get_info` reports the proxy the sandbox's egress is currently tunneled through. The password is never returned, so the returned `SandboxEgressProxyInfo` does not have the field at all:

  ```ts
  const info = await sandbox.getInfo()
  console.log(info.network?.egressProxy)
  // { address: 'proxy.example.com:1080', username: 'proxy-user' }
  ```

  ```python
  info = sandbox.get_info()
  print(info.network.get("egress_proxy"))
  # {'address': 'proxy.example.com:1080', 'username': 'proxy-user'}
  ```

  Egress fails closed: when the proxy is unreachable or does not speak SOCKS5, outbound connections fail rather than falling back to a direct connection. The address is validated server-side when the sandbox is created — a rejected create leaves nothing behind. Available on E2B Cloud and in BYOC deployments; a sandbox that names a proxy on a deployment built from the open source `e2b-dev/infra` repository is rejected as unsupported.

## 2.40.0

### Minor Changes

- 6248b12: Remove the deprecated `accessToken` / `access_token` option and its `E2B_ACCESS_TOKEN` environment fallback. E2B access tokens are no longer accepted for API authentication, so the SDKs no longer resolve one or send it as an `Authorization: Bearer` header — requests authenticate with the API key alone.

  If you were relying on the option to send a bearer token to a custom deployment, pass the header directly, which is what the deprecation notice already pointed to:

  ```ts
  // Before
  const sandbox = await Sandbox.create({ accessToken: token })

  // After
  const sandbox = await Sandbox.create({
    apiHeaders: { Authorization: `Bearer ${token}` },
  })
  ```

  ```python
  # Before
  config = ConnectionConfig(access_token=token)

  # After
  config = ConnectionConfig(api_headers={"Authorization": f"Bearer {token}"})
  ```

  Note that `Sandbox.envd_access_token` / `traffic_access_token` are unrelated per-sandbox tokens and are unaffected.

## 2.39.0

### Minor Changes

- 07eb9be: Allow a network rule's `transform` to be a callback, so a workload identity token from the `iam` option can be injected into egress requests without the SDK ever seeing its value. The callback receives placeholder strings that the egress proxy resolves per request — `iam.tokens.aws` is `${e2b.identity.tokens.aws}` on the wire — and referencing a token that is not registered in `iam.tokens` fails with `InvalidArgumentError` / `InvalidArgumentException` instead of silently sending a placeholder no token will ever replace.

  `updateNetwork` / `update_network` accepts the same callbacks, but its payload carries no `iam` config, so token names cannot be checked there and every name resolves to its placeholder.

  Token names are validated where they are registered and again before they are interpolated: a name cannot be empty or contain `{`, `}` or control characters, since the proxy reads a placeholder up to its first `}` and a brace in the name would resolve a different token than the one referenced.

  ```ts
  import { Sandbox, Secret } from 'e2b'

  const sandbox = await Sandbox.create({
    iam: {
      tokens: {
        aws: Secret.iamToken({
          audience: 'sts.amazonaws.com',
          tokenType: 'JWT-SVID',
        }),
      },
    },
    network: {
      allowOut: ({ rules }) => [...rules.keys()],
      rules: {
        'api.internal.example.com': [
          {
            transform: ({ iam }) => ({
              headers: { Authorization: `Bearer ${iam.tokens.aws}` },
            }),
          },
        ],
      },
    },
  })
  ```

  ```python
  from e2b import Sandbox, Secret

  sandbox = Sandbox.create(
      iam={
          "tokens": {
              "aws": Secret.iam_token(audience="sts.amazonaws.com", token_type="JWT-SVID"),
          },
      },
      network={
          "allow_out": lambda ctx: list(ctx.rules.keys()),
          "rules": {
              "api.internal.example.com": [
                  {
                      "transform": lambda ctx: {
                          "headers": {"Authorization": f"Bearer {ctx.iam.tokens['aws']}"},
                      },
                  },
              ],
          },
      },
  )
  ```

- 64b25bb: Add the `iam` option to `Sandbox.create` for configuring sandbox workload identity, and a `Secret` class with an `iamToken` / `iam_token` method for defining the workload tokens. Passing a non-empty `tokens` map (name → `{ audience, tokenType }`) enables workload identity for the sandbox:

  ```ts
  import { Sandbox, Secret } from 'e2b'

  const sandbox = await Sandbox.create({
    iam: {
      tokens: {
        aws: Secret.iamToken({
          audience: 'sts.amazonaws.com',
          tokenType: 'JWT-SVID',
        }),
      },
    },
  })
  ```

  ```python
  from e2b import Sandbox, Secret

  sandbox = Sandbox.create(
      iam={
          "tokens": {
              "aws": Secret.iam_token(audience="sts.amazonaws.com", token_type="JWT-SVID"),
          },
      },
  )
  ```

  Plain `{ audience, tokenType }` objects (`{"audience": ..., "token_type": ...}` dicts in Python) are accepted as token values too.

## 2.38.3

### Patch Changes

- cab27aa: Kill newly created sandboxes when MCP gateway startup fails. The failure now surfaces as `SandboxError` (JS) / `SandboxException` (Python) with a `Failed to start MCP gateway: <stderr>` message instead of a bare command exit error.

## 2.38.2

### Patch Changes

- d5a382e: Bump both undici dependencies past the 2026-07-24 security advisories: the required `undici` from `^7.28.0` to `^7.29.0`, and the optional `undici8` (`npm:undici@…`) from 8.8.0 to 8.10.0. Both releases fix one High ([GHSA-4cwx-7wf7-3272](https://github.com/nodejs/undici/security/advisories/GHSA-4cwx-7wf7-3272)) and four Medium advisories, and undici 8.10.0 additionally fixes HTTP/2 request settling, refused-stream retries and GOAWAY handling, which the SDK exercises because every dispatcher it builds sets `allowH2: true`. Neither bump moves a Node floor — 7.29.0 still requires Node `>=20.18.1` and 8.10.0 still requires `>=22.19.0`, matching the `UNDICI_8_MIN_NODE` gate — so package selection and behaviour are unchanged.

## 2.38.1

### Patch Changes

- 88f41f3: Align ANSI stripping of template build log messages across both SDKs. The Python SDK's `strip_ansi_escape_codes` now ports the JS SDK's `stripAnsi` regex: OSC sequences (hyperlinks, window titles) are matched non-greedily up to the first string terminator — including sequences spanning newlines — and CSI sequences are stripped without requiring a terminator. Both implementations additionally strip the remaining ECMA-48 string controls (DCS/Sixel, SOS, PM, APC) through their string terminator so control payloads no longer leak into cleaned logs.
- 86f7b8e: Export `GitResetMode`, `GitResetOpts`, `GitRestoreOpts` and `GitStatusLabel` from the JS SDK entry point, so the argument and status types of the public `git.reset()`, `git.restore()` and `git.status()` methods can be named by callers

## 2.38.0

### Minor Changes

- 2821fb0: Route volume content requests to a team's custom (BYOC) cluster. When a team is connected to a custom cluster, the volume create and get endpoints now return that cluster's `domain`, and the SDK uses it as the destination for volume content requests instead of the default `api.<E2B_DOMAIN>` host. Teams on the default cluster are unaffected and keep their configured domain.

## 2.37.0

### Minor Changes

- 1504fbc: Add `fromFedoraImage`, `fromAlpineImage`, and `fromArchImage` base-image helpers to the `Template` builder (`from_fedora_image`, `from_alpine_image`, `from_arch_image` in the Python SDK), alongside the existing `fromUbuntuImage`/`fromDebianImage`/etc. Templates can now start from Fedora, Alpine, and Arch base images (the orchestrator identifies the distro from `/etc/os-release`). Fedora and Alpine default to pinned tags (`fedora:44`, `alpine:3.24`) so builds stay reproducible; Arch defaults to `latest` because it is a rolling release and provisioning runs `pacman -Syu` regardless.

### Patch Changes

- 6733f36: Align the Python SDK's `from_fedora_image` and `from_alpine_image` defaults with the JS SDK: `fedora:44` and `alpine:3.24`, replacing `fedora:42` (end-of-life, so its repositories leave the normal mirror network and provisioning can fail) and `alpine:3.22`. Callers that omit the variant now get the same base image in both SDKs, and both tags are the ones the orchestrator's distro build tests cover. Also corrects the JS `TemplateFromImage` type docs, which still named the old defaults.
- 1ebe925: Recognize web platform objects by what they are, not by which class minted them. Libraries replace the web globals the same way they replace `globalThis.fetch` (`@hono/node-server` installs its own `Request`, remix's `installGlobals()` swaps `Request`/`Blob`/`File`, `web-streams-polyfill` swaps `ReadableStream`, jsdom-style test environments bring their own copies), and values also cross realms — so a perfectly good `Request`, `Blob` or `ReadableStream` could fail the SDK's `instanceof` checks and take the wrong branch. This fixes: every API call crashing with `Failed to parse URL from [object Request]`; the abort signal of such a `Request` being ignored while it waited for an in-flight slot; uploads of a foreign `Blob` or `ReadableStream` — including the body of such a `Request` — silently containing the text `"[object Blob]"`/`"[object ReadableStream]"`; gzipped uploads of a foreign stream hanging; a foreign stream being buffered into memory instead of streamed; and `volume.readFile()` returning empty data.
- ee0ad25: Update snapshot docstrings to use project terminology instead of team (e.g. "my-project/my-snapshot", project slug)
