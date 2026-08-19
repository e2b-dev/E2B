# @e2b/python-sdk

## 2.45.0

### Minor Changes

- 8787dfe: Add sorting and new filters to `Sandbox.list`. The `order` option (`'asc'` / `'desc'`, default `'desc'`) sorts sandboxes by start time across the whole paginated dataset, and the query now supports `startedAfter` / `started_after` (inclusive lower bound on start time) and `template` (exact template ID or alias) filters, all applied server-side before pagination. The CLI `e2b sandbox list` command exposes these via `--order`, `--started-after`, and `--template`.

## 2.44.0

### Minor Changes

- 5759f17: Add an `E2B` client that binds a connection config once and exposes the resource surfaces off it, so a single process can talk to several API keys, domains or deployments. The classes it exposes are per-client subclasses of the real `Sandbox`/`Volume`/`Template`/`Secret` classes, so they behave exactly like the top-level ones — per-call options still win over the client's options, which win over the environment variables. The named top-level exports are unchanged and keep reading the environment.

  Nothing existing changes: `Template` is now the `TemplateBase` class made callable as a factory, so `Template(...)`, the statics and `instanceof` keep working, and the default export is still `Sandbox`.

  ```ts
  import { E2B } from 'e2b'

  const { Sandbox, Volume, Template, Secret } = new E2B({
    apiKey: 'e2b_***',
    domain: 'e2b.dev',
  })

  const sandbox = await Sandbox.create()
  const volume = await Volume.create('my-volume')
  const exists = await Template.exists('my-template')
  await Template.build(Template().fromPythonImage('3'), 'my-env')
  await Secret.create('openai-api-key', 'sk-***')
  ```

  ```python
  from e2b import E2B

  client = E2B(api_key="e2b_***", domain="e2b.dev")
  Sandbox, Volume, Template = client.Sandbox, client.Volume, client.Template
  Secret = client.Secret

  sandbox = Sandbox.create()
  volume = Volume.create("my-volume")
  exists = Template.exists("my-template")
  secret = Secret.create("openai-api-key", "sk-***")

  # Async variants are exposed too.
  AsyncSandbox = client.AsyncSandbox
  async_sandbox = await AsyncSandbox.create()
  ```

## 2.43.0

### Minor Changes

- f89f8c3: Add Secrets Management to the SDK. The `Secret` class (and `AsyncSecret` in Python) now manages E2B secrets: `create` and `update` store secret values (write-only — no read surface returns them), `getInfo` / `get_info` and the paginated `list` read metadata, `exists` and `destroy` are idempotent existence and lifecycle helpers, and `fill` formats the `${e2b.secrets.name}` placeholder that the runtime resolves to the secret's current value.

### Patch Changes

- 2be6c12: Internal refactor: the template API operations resolve their connection config through a class-level hook, so a `TemplateBase` subclass can carry bound connection options. No behavior change — `Template` / `AsyncTemplate` keep reading config from per-call options and environment variables. In the Python SDK the terminal template operations (`build`, `build_in_background`, `get_build_status`, `exists`, `alias_exists`, `assign_tags`, `remove_tags`, `get_tags`) became `classmethod`s, with signatures unchanged for callers.
- 05aa03c: Add typed not-found errors for volumes: `VolumeNotFoundError` / `VolumeNotFoundException` (thrown when a volume is not found) and `VolumePathNotFoundError` / `VolumePathNotFoundException` (thrown when a path inside a volume is not found). All subclass the existing `NotFoundError` / `NotFoundException`, so existing catches keep working.

## 2.42.0

### Minor Changes

- 7af41e9: Refresh the MCP server types from the current MCP gateway catalog: 49 servers are new (`n8n`, `neo4j`, `okta`, `temporal`, `proxmox`, `zscaler`, the AWS Labs family, ...), 61 titles and 10 descriptions were rewritten, and 4 servers changed their options (`awsDiagram`, `context7`, `neo4jCypher`, `onlyofficeDocspace`).

  Six servers the catalog no longer publishes are gone from `McpServer`: `postgres`, `root`, `tembo`, `flexprice`, `triplewhale`, `cdataConnectcloud`. `awsDiagram` and `context7` now require an option (`outputDir` and `apiKey`), so `awsDiagram: {}` and `context7: {}` stop type-checking, and `onlyofficeDocspace` is down to `baseUrl` and `docspaceApiKey`. The removals also narrow `McpServerName`, so `Template().addMcpServer('postgres')` stops compiling. The config is still passed to the gateway as written, so a dropped server can be kept by casting past the type — whether it starts is up to the gateway.

  ```ts
  import { Sandbox } from 'e2b'

  const sandbox = await Sandbox.create({
    mcp: {
      n8n: {
        apiKey: process.env.N8N_API_KEY!,
        apiUrl: 'https://n8n.example.com/api/v1',
      },
    },
  })
  ```

### Patch Changes

- 15bd48b: Omit `autoPause` from the create-sandbox request when no timeout lifecycle is configured, and omit `autoPauseMemory` unless `keepMemory` / `keep_memory` was chosen. Sending the SDK's local defaults for those fields was indistinguishable from an explicit choice, so the API could not tell "no preference" from a client choice and own its defaults. Explicit values are still always sent:

  ```ts
  import { Sandbox } from 'e2b'

  // No timeout lifecycle: autoPause is omitted, the API applies its default.
  await Sandbox.create()

  // Explicit action: autoPause: false / autoPause: true, as before.
  await Sandbox.create({ lifecycle: { onTimeout: 'kill' } })
  await Sandbox.create({ lifecycle: { onTimeout: 'pause' } })

  // Snapshot kind is only sent when keepMemory is set.
  await Sandbox.create({
    lifecycle: { onTimeout: { action: 'pause', keepMemory: false } },
  })
  ```

  ```python
  from e2b import Sandbox

  # No timeout lifecycle: auto_pause is omitted, the API applies its default.
  Sandbox.create()

  # Explicit action: autoPause: false / autoPause: true, as before.
  Sandbox.create(lifecycle={"on_timeout": "kill"})
  Sandbox.create(lifecycle={"on_timeout": "pause"})

  # Snapshot kind is only sent when keep_memory is set.
  Sandbox.create(
      lifecycle={"on_timeout": {"action": "pause", "keep_memory": False}}
  )
  ```

- 5367693: Omit `autoResume` from the `POST /sandboxes` request when `lifecycle.autoResume` / `lifecycle["auto_resume"]` is not configured, instead of sending the SDK's local default as `{ "autoResume": { "enabled": false } }`. The API can now tell an unset preference from an explicit opt-out and own the default itself. Explicit values are unchanged on the wire.

  ```ts
  import { Sandbox } from 'e2b'

  // autoResume is left out of the request entirely — the API's default applies
  await Sandbox.create({ lifecycle: { onTimeout: 'pause' } })

  // an explicit choice is still sent as before
  await Sandbox.create({ lifecycle: { onTimeout: 'pause', autoResume: true } })
  ```

  ```python
  from e2b import Sandbox

  # auto_resume is left out of the request entirely — the API's default applies
  Sandbox.create(lifecycle={"on_timeout": "pause"})

  # an explicit choice is still sent as before
  Sandbox.create(lifecycle={"on_timeout": "pause", "auto_resume": True})
  ```

- 666241d: Run every persistent HTTP stack in the SDK on one shared pyqwest connection pool
  instead of four: the control-plane REST API, the envd HTTP API, the envd RPC
  clients, and the volume content API now all draw from
  `e2b.api.client_sync`/`client_async`, keyed on the three knobs that are fixed
  when a pyqwest transport is built — proxy, idle read bound, and HTTP version.
  reqwest pools per host internally, so one pool serves the API host and every
  per-sandbox host without interference — and since envd RPC and the envd HTTP API
  hit the same host, an active sandbox now needs a single HTTP/2 connection instead
  of one per stack. Streamed downloads keep a pool of their own, the only one
  carrying the idle `read_timeout`: reqwest's read timer runs during body send and
  TTFB, so on a shared pool it would cut off long uploads. No signature changes —
  `get_transport` and `get_envd_transport` keep the `http2` parameter restored in
  2.39.1, and the two are now the same pool per key rather than two.
- 2daced6: Tag the package homepage and README links with UTM parameters (`utm_source=npm`/`pypi`) so registry traffic to e2b.dev is attributed correctly. No functional change.

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

### Patch Changes

- 02ba746: Raise the `h2` floor to `>=4.4.1` so it can no longer resolve to a version affected by CVE-2026-71554, where a duplicate `Host` header is forwarded to the consuming application and becomes a request smuggling primitive once HTTP/2 is downgraded to HTTP/1.1.
- e2eebd5: Fix URL encoding of namespaced template names and aliases in the Python SDK.

  The endpoints that take a template ID also accept a template name, and names may
  be namespaced (e.g. `namespace/name`). The SDK interpolated them into the request
  path without encoding, so a call like `Template.exists("namespace/name")` hit
  `/templates/aliases/namespace/name` instead of
  `/templates/aliases/namespace%2Fname` — the slash split the route rather than
  staying inside one path segment. Every method that takes a template ID or name,
  an alias, or a snapshot ID in the path — `Template.exists` / `alias_exists`,
  `get_tags`, the build/upload/status calls, and `Sandbox.delete_snapshot` (whose
  snapshot IDs are `namespace/name:tag`) — now percent-encodes the value, matching
  the JavaScript SDK (which already encodes path parameters via
  `encodeURIComponent`).

  ```python
  from e2b import Template, Sandbox

  # Namespaced templates now resolve correctly
  Template.exists("my-team/my-template")
  Template.get_tags("my-team/my-template")

  # Namespaced snapshots can now be deleted
  Sandbox.delete_snapshot("my-team/my-snapshot:default")
  ```

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

## 2.39.1

### Patch Changes

- 0d507cd: Restore the `http2` parameter on `get_transport` and `get_envd_transport`, which the pyqwest migration dropped in 2.38.0. `http2=False` again returns a transport pinned to HTTP/1.1, on its own connection pool.

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

### Patch Changes

- 11912ff: Build the envd HTTP API client once per sync `Sandbox` and share it across the
  filesystem, commands, and PTY modules, which now receive it instead of each
  constructing their own — matching `AsyncSandbox`. No behavior change: the
  pyqwest transport underneath is already cached process-wide per
  `(proxy, for_streaming)`, so the separate clients shared one connection pool
  either way. `Filesystem` still builds the streaming sibling client whose
  transport carries the idle read timeout, in both flavors.

## 2.38.0

### Minor Changes

- b048369: Move the envd HTTP API client (sandbox file transfers, health checks) onto
  [`pyqwest`](https://pypi.org/project/pyqwest/) via its httpx-compatible
  transport adapter. envd RPC already runs on pyqwest through `connectrpc`, so
  all sandbox traffic now shares one HTTP stack built from the same transport
  pieces (with separate connection pools per use).

  The per-thread (sync) and per-loop (async) envd httpx clients are gone: the
  pyqwest transports are thread-safe and loop-independent, so a single client
  per module serves all threads and event loops.

  Timeout semantics through the adapter:
  - Streamed downloads (`files.read(format="stream")`): a `request_timeout`
    set explicitly for the call is the deadline for the whole transfer — by
    default the transfer is unbounded in total, as before. A stalled stream is
    reclaimed by a 60-second idle read timeout that resets on every chunk.
    `stream_idle_timeout` keeps working on the async client (applied per
    read); the sync client cannot interrupt a blocking read, so it relies on
    the transport-wide idle bound and now ignores the parameter.
  - Uploads: a buffered upload is bounded by `request_timeout` as a
    whole-request deadline, and a streamed (file-like) upload carries no
    client-side timeout (a stalled one is bounded server-side by envd's idle
    read timeout) — both matching the JS SDK.
  - Non-streamed reads (`files.read()` as text or bytes) and buffered uploads
    are bounded by `request_timeout` for the **whole transfer** (default
    60 seconds), where the previous transport bounded each socket operation
    and left total duration unbounded. Reading or writing a file too large to
    transfer inside the deadline now raises `httpx.ReadTimeout` — pass a
    larger `request_timeout` (or `0` to disable), or use
    `format="stream"`/file-like data, for large transfers.

  `E2B_MAX_CONNECTIONS` is no longer read: it configured httpx's global
  connection cap, and the last transport that took one is gone (reqwest has no
  counterpart — it does not cap concurrent connections). `E2B_KEEPALIVE_EXPIRY`
  and `E2B_MAX_KEEPALIVE_CONNECTIONS` keep tuning the pools.

- a874ced: Move the REST API client (sandbox lifecycle, listing, templates, volumes
  control plane) onto [`pyqwest`](https://pypi.org/project/pyqwest/) (Rust
  reqwest/hyper) via its httpx-compatible transport adapter, replacing the
  httpx-native `HTTPTransport`/`AsyncHTTPTransport`. The generated httpx client
  API is unchanged — only the transport underneath is swapped — so logging
  event hooks, headers, and redirect handling (`follow_redirects`,
  `response.history`) behave as before.

  One timeout semantics change: through the adapter, `request_timeout` is a
  deadline for the whole API call, where the previous transports applied it to
  each phase (connect, read, write) separately — a slow request could exceed it
  in total. For the REST API's small JSON exchanges this tightening is what
  `request_timeout` reads as promising; `0` still disables it.

  Because pyqwest transports are thread-safe and loop-independent (I/O runs on
  a Rust runtime), the API connection pool is now shared process-wide per
  proxy, instead of one pool per thread (sync) or per event loop (async), and
  `ApiClient` no longer maintains per-thread/per-loop httpx client caches — a
  single httpx client serves all threads and event loops.
  Connection-establishment failures are retried with backoff
  (`E2B_CONNECTION_RETRIES`, default 3), matching the connect-only retries of
  the previous transports. Timeouts keep raising `httpx.ReadTimeout` (an
  `httpx.TimeoutException`), as before, whether they fire while waiting for the
  response head or while reading the response body, and connection, network, and
  protocol failures keep raising their `httpx` counterparts (`httpx.ConnectError`,
  `httpx.ReadError`, `httpx.RemoteProtocolError`).

  `proxy` for API calls takes a URL string (e.g.
  `proxy="http://user:pass@localhost:8030"`, scheme http, https, socks5, or
  socks5h), an `httpx.URL`, or an `httpx.Proxy` — including its credentials
  (sent as `Proxy-Authorization`) and any headers configured for the proxy. The
  one `httpx.Proxy` option pyqwest cannot express, a per-proxy `ssl_context`,
  raises `InvalidArgumentException` rather than being silently dropped.

  Low-level HTTP logs stay available: where enabling the `httpcore` logger used
  to show connection-level detail, pyqwest logs one line per request on the
  `pyqwest.access` logger and request lifecycle records on `pyqwest`, both at
  `DEBUG` and off unless enabled:

  ```python
  import logging

  logging.basicConfig()
  logging.getLogger("pyqwest.access").setLevel(logging.DEBUG)
  # DEBUG pyqwest.access - HTTP Request: POST https://api.e2b.app/sandboxes "HTTP/2 201 Created"
  ```

  The SDK's own `logger` option is unchanged and independent of these.

  envd traffic is not affected: RPC (commands, PTY, filesystem watch) already
  runs on pyqwest via `connectrpc`, and the envd HTTP API (file transfers,
  health checks) keeps its httpx transports.

- b3a7c9f: Move template build-context uploads (to S3 presigned URLs) onto
  [`pyqwest`](https://pypi.org/project/pyqwest/) via its httpx-compatible
  transport adapter. Content-Length framing for the streamed archive body is
  preserved (S3 rejects chunked transfer encoding), and redirects stay with the
  httpx client instead of being followed inside the transport. The 1-hour upload
  timeout now bounds the entire upload rather than each socket operation, and
  `verify_ssl=False` on the client is no longer honored for uploads (pyqwest
  has no insecure-TLS option).
- 458c2c4: Move the volume content client (`Volume`/`AsyncVolume` file operations) onto
  [`pyqwest`](https://pypi.org/project/pyqwest/) via its httpx-compatible
  transport adapter, the same stack the REST API client uses. The connection
  pool is shared process-wide per proxy instead of one pool per thread (sync)
  or per event loop (async), and connection-establishment failures are retried
  with backoff (`E2B_CONNECTION_RETRIES`, default 3), as before.

  For streamed volume reads (`Volume.read_file(format="stream")`), a stalled
  stream is by default bounded by a transport-wide idle read timeout of
  60 seconds that resets on every chunk (still surfaced as
  `httpx.ReadTimeout`; matches the JS SDK's default stream idle timeout).
  `AsyncVolume.read_file` keeps honoring an explicit `stream_idle_timeout`
  per read (including `0` to disable); the sync client ignores it — it cannot
  interrupt a blocking read. Passing `request_timeout` to a streamed read now
  bounds the whole transfer rather than individual socket operations.

  The same whole-transfer semantics apply to non-streamed operations:
  `read_file(format="text"/"bytes")` and uploads are bounded by
  `request_timeout` as a total deadline (default 1 hour for file content
  operations), where the previous transports bounded each socket operation
  and left total duration unbounded. Pass a larger `request_timeout` (or `0`
  to disable) for very large transfers on slow links.

### Patch Changes

- cab27aa: Kill newly created sandboxes when MCP gateway startup fails. The failure now surfaces as `SandboxError` (JS) / `SandboxException` (Python) with a `Failed to start MCP gateway: <stderr>` message instead of a bare command exit error.

## 2.37.1

### Patch Changes

- 88f41f3: Align ANSI stripping of template build log messages across both SDKs. The Python SDK's `strip_ansi_escape_codes` now ports the JS SDK's `stripAnsi` regex: OSC sequences (hyperlinks, window titles) are matched non-greedily up to the first string terminator — including sequences spanning newlines — and CSI sequences are stripped without requiring a terminator. Both implementations additionally strip the remaining ECMA-48 string controls (DCS/Sixel, SOS, PM, APC) through their string terminator so control payloads no longer leak into cleaned logs.
- 998e560: Relax the Python SDK's `wcmatch` requirement from `>=10.1,<11` to `>=10.1,<12` so `e2b` can be installed alongside packages that already require `wcmatch>=11` (for example `deepagents>=0.7.0`), which previously failed to resolve. The SDK only calls `glob.glob()` with `GLOBSTAR | DOTMATCH` for template context matching; wcmatch 11.0's single breaking change affects `translate()` callers using extended-glob capture groups, so it is a no-op here. The template glob test suite passes against 10.1, 10.2.1 and 11.0.

## 2.37.0

### Minor Changes

- 2821fb0: Route volume content requests to a team's custom (BYOC) cluster. When a team is connected to a custom cluster, the volume create and get endpoints now return that cluster's `domain`, and the SDK uses it as the destination for volume content requests instead of the default `api.<E2B_DOMAIN>` host. Teams on the default cluster are unaffected and keep their configured domain.

## 2.36.0

### Minor Changes

- 1504fbc: Add `fromFedoraImage`, `fromAlpineImage`, and `fromArchImage` base-image helpers to the `Template` builder (`from_fedora_image`, `from_alpine_image`, `from_arch_image` in the Python SDK), alongside the existing `fromUbuntuImage`/`fromDebianImage`/etc. Templates can now start from Fedora, Alpine, and Arch base images (the orchestrator identifies the distro from `/etc/os-release`). Fedora and Alpine default to pinned tags (`fedora:44`, `alpine:3.24`) so builds stay reproducible; Arch defaults to `latest` because it is a rolling release and provisioning runs `pacman -Syu` regardless.

### Patch Changes

- 6733f36: Align the Python SDK's `from_fedora_image` and `from_alpine_image` defaults with the JS SDK: `fedora:44` and `alpine:3.24`, replacing `fedora:42` (end-of-life, so its repositories leave the normal mirror network and provisioning can fail) and `alpine:3.22`. Callers that omit the variant now get the same base image in both SDKs, and both tags are the ones the orchestrator's distro build tests cover. Also corrects the JS `TemplateFromImage` type docs, which still named the old defaults.
- 45d2679: Regenerate `e2b/sandbox/mcp.py` with `datamodel-code-generator` 0.64.0: the MCP server option types now use builtin generics (`list[str]`, `dict[str, Any]`) and are closed `TypedDict`s, mirroring the spec's `additionalProperties: false`. Raises the `typing-extensions` floor to `>=4.10.0`, the first release accepting PEP 728's `closed`.
- ee0ad25: Update snapshot docstrings to use project terminology instead of team (e.g. "my-project/my-snapshot", project slug)
