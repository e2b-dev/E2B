# e2b

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
