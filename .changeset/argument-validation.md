---
'e2b': minor
'@e2b/python-sdk': minor
---

Refuse arguments the server never sees as they were given, and stop duplicating two checks the API makes itself. Each refusal is an `InvalidArgumentError` / `InvalidArgumentException` raised before a request is sent.

Fixed:

- An empty ID or name, `.` and `..` are refused where they would become a path segment and the URL used to collapse onto another route: every API call in JS (`Sandbox.kill('')`, `Template.exists('..')`, `Volume.connect('')`), and template names in Python.
- `files.remove('')` and `files.rename()` with an empty path are refused; envd reads an empty path as the home directory.
- `pipInstall` / `npmInstall` / `bunInstall` / `aptInstall` quote a package argument the shell would redirect or split, so `pipInstall('numpy>=2')` installs that range instead of writing a file named `=2`. Other arguments are written as before.
- **JS:** `timeoutMs` and `requestTimeoutMs` of `Infinity` now mean no timeout and a value above 2³¹−1 ms is capped, where both used to time out after 1 ms; fractions are rounded up instead of throwing a `RangeError`.
- **Python:** `request_timeout=0` now disables the timeout on instance methods (`sandbox.kill()`, `set_timeout()`, `get_info()`, …) and on template file uploads, as it already did elsewhere.
- **Python:** `limit=0` and an empty template name are sent to the API instead of being replaced by the defaults.

Now refused (these used to be accepted and do something else):

- A negative, `NaN` or non-numeric `timeoutMs` / `timeout` / `requestTimeoutMs` / `request_timeout`. A negative command timeout meant "no timeout" in JS and a 1 ms deadline in Python.
- A network `allowOut` / `denyOut` callback that returns nothing, and a string passed for `allowOut`, `denyOut` or `dnsServers`.
- `envs`, `metadata` and network transform `headers` with a missing value (`undefined` in JS, `None` in Python), which was dropped from the request.
- **JS:** `files.write()` data that is not a string, `ArrayBuffer`, `Uint8Array`, `Blob`, `ReadableStream` or `AsyncIterable`, and a multi-file entry without a `path`.
- A `pid` outside 0–2³²−1 and PTY `cols` / `rows` outside 1–65535.
- A `useSignatureExpiration` that is not a whole number of seconds.
- A template `copy` / `makeDir` `mode` outside 0–0o7777, a `gitClone` `depth` that is not a positive integer, and `waitForPort`, `waitForURL` and `waitForTimeout` arguments that are not a port, an HTTP status code or a duration.

No longer checked by the SDK (the API answers with a 400 instead):

- The length and characters of `idempotencyKey`. Only a key that could not be sent as given is still refused: empty, not printable ASCII, or with a space at either end.
- **JS:** the status names passed to `Template.listBuilds({ statuses })`.
