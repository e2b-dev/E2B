# e2b

## 2.37.0

### Minor Changes

- 1504fbc: Add `fromFedoraImage`, `fromAlpineImage`, and `fromArchImage` base-image helpers to the `Template` builder (`from_fedora_image`, `from_alpine_image`, `from_arch_image` in the Python SDK), alongside the existing `fromUbuntuImage`/`fromDebianImage`/etc. Templates can now start from Fedora, Alpine, and Arch base images (the orchestrator identifies the distro from `/etc/os-release`). Fedora and Alpine default to pinned tags (`fedora:44`, `alpine:3.24`) so builds stay reproducible; Arch defaults to `latest` because it is a rolling release and provisioning runs `pacman -Syu` regardless.

### Patch Changes

- 6733f36: Align the Python SDK's `from_fedora_image` and `from_alpine_image` defaults with the JS SDK: `fedora:44` and `alpine:3.24`, replacing `fedora:42` (end-of-life, so its repositories leave the normal mirror network and provisioning can fail) and `alpine:3.22`. Callers that omit the variant now get the same base image in both SDKs, and both tags are the ones the orchestrator's distro build tests cover. Also corrects the JS `TemplateFromImage` type docs, which still named the old defaults.
- 1ebe925: Recognize web platform objects by what they are, not by which class minted them. Libraries replace the web globals the same way they replace `globalThis.fetch` (`@hono/node-server` installs its own `Request`, remix's `installGlobals()` swaps `Request`/`Blob`/`File`, `web-streams-polyfill` swaps `ReadableStream`, jsdom-style test environments bring their own copies), and values also cross realms — so a perfectly good `Request`, `Blob` or `ReadableStream` could fail the SDK's `instanceof` checks and take the wrong branch. This fixes: every API call crashing with `Failed to parse URL from [object Request]`; the abort signal of such a `Request` being ignored while it waited for an in-flight slot; uploads of a foreign `Blob` or `ReadableStream` — including the body of such a `Request` — silently containing the text `"[object Blob]"`/`"[object ReadableStream]"`; gzipped uploads of a foreign stream hanging; a foreign stream being buffered into memory instead of streamed; and `volume.readFile()` returning empty data.
- ee0ad25: Update snapshot docstrings to use project terminology instead of team (e.g. "my-project/my-snapshot", project slug)
