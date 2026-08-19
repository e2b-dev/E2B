# TASTE.md

Design principles for the E2B SDKs — how the public API surface of `packages/js-sdk` and `packages/python-sdk` should look and behave. When a new feature forces a design decision, prefer the option that matches the patterns below — consistency with the existing surface beats local optimality.

## Parity across languages is non-negotiable

- The three surfaces — JS, sync Python, and async Python — mirror each other 1:1 in names and semantics, differing only by language idiom:
  - JS `camelCase` ↔ Python `snake_case` (`setTimeout` ↔ `set_timeout`, `getInfo` ↔ `get_info`).
  - Classes stay PascalCase in both (`Sandbox`, `ConnectionConfig`, `Volume`).
  - Error suffix follows language convention: JS `...Error`, Python `...Exception` (`SandboxError` ↔ `SandboxException`). The prefix is identical.
  - JS takes a single trailing options object (`SandboxOpts`); Python takes kwargs typed with `TypedDict` + `Unpack`.
- Python sync and async are physically separate mirrors (`sandbox_sync/`, `sandbox_async/`) with shared logic in `sandbox/`. Async classes are prefixed `Async...` (`AsyncSandbox`, `AsyncCommandHandle`); sync is the unprefixed default. Same method names and signatures either way.

## API shape

- **The golden rule: required arguments are positional, optional parameters go in a trailing options object.** `Template.build(template, name, { cpuCount, memoryMB })`, never `Template.build(template, name, cpuCount, memoryMB)`. In Python the options object becomes kwargs: `Template.build(template, name, cpu_count=…, memory_mb=…)`. This holds from the very first optional parameter — `downloadUrl(path, opts)`, not `downloadUrl(path, useSignature, signatureExpirationInSeconds)`. A chain of optional positionals is never the answer, no matter how short.
- Objects with remote lifecycles are obtained through async static factories, never bare constructors: `Sandbox.create()`, `Sandbox.connect()`, `Sandbox.fork()`, `Sandbox.list()`. Constructors are internal wiring. In JS, factories use self-type generics so subclasses return the subclass; in Python, use `@classmethod`.
- Control-plane operations come in pairs — instance method and static-by-id: `sandbox.kill()` and `Sandbox.kill(sandboxId)`. JS expresses this with overloads; Python with the `class_method_variant` descriptor (`e2b/sandbox/utils.py`), or `DualMethod` (`e2b/volume/utils.py`) when the class and instance forms genuinely mean different things (`Volume.list()` lists volumes, `volume.list(path)` lists a directory).
- The two halves of such a pair take different options. The static-by-id form has no instance to inherit identity from, so it forwards the *whole* connection surface it was handed — `apiKey`, `domain`, `apiUrl`, `proxy`, `headers` — into `ConnectionConfig`; destructuring just `{ apiKey, domain }` silently drops self-hosted deployments and proxies. The instance form takes only operation-specific params plus `requestTimeoutMs` / `request_timeout`, never connection or identity options that already live on the instance — in JS, `Pick<SomeFullOpts, 'requestTimeoutMs' | …>`.
- Methods that reference an entity accept both its ID and its name in the same argument: `Sandbox.create('<template ID or name>')`, `Template.getTags('<template ID or name>')`. Don't add separate by-id/by-name variants.
- Functionality is grouped into sub-namespaces on the instance rather than flat methods: `sandbox.files`, `sandbox.commands`, `sandbox.pty`.
- Method names are verbs, even when they only fetch state: `sandbox.getInfo()` / `get_info()`, `getMetrics`, `createSnapshot`, never a bare noun like `sandbox.info`. The verb also names what it acts on unless the sub-namespace already does — the flat builder method is `template.runCmd()`, while inside `sandbox.commands` a plain `run()` is fine.
- New option names should mirror exactly across SDKs (`metadata`, `envs`, `allowInternetAccess` / `allow_internet_access`) and extend the shared connection opts (`SandboxOpts extends ConnectionOpts` in JS, `ApiParams` TypedDict in Python).
- When a concept already has a named type, use it instead of the primitive it aliases — a system user is `Username`, not `string`. The alias is what makes the parameter greppable and gives the surface a single place to tighten later.
- Acronyms are cased as words in identifiers: `Url`, `Http`, `Id` — `apiUrl`, `sandboxUrl`, `sandboxId`, never `apiURL` or `sandboxID`. All-caps forms belong only to names that aren't ours: wire fields in the generated client (`sandboxID` in `schema.gen.ts`) and platform types (`URL`, `URLSearchParams`). Unit suffixes keep their symbol's casing: `memoryMB` / `memory_mb`, `timeoutMs` / `timeout_ms`. In prose and docstrings, acronyms stay all-caps: "the sandbox URL", "HTTP status".
- When a feature is configured per entry in a map, the key's presence enables it and its value is the config — an empty object is the legitimate spelling of "enabled with nothing to configure" (`mcp: { duckduckgo: {} }`), not `true`, `null`, or `None` sentinels.
- Prefer enums over booleans for options that select a behavior — a string-literal union reads better at the call site and leaves room for a third variant without a breaking change: `Sandbox.pause(sandboxId, { mode: 'memory' })`, not `Sandbox.pause(sandboxId, { keepMemory: true })`.
- A fixed set of string values the SDK hands back or dispatches on gets a named enum — `FileType`, `FilesystemEventType`, `InstructionType` (JS `enum`, Python `Enum`) — and every read of it goes through a member, never a bare `'file'` / `'COPY'` literal. The enum is the one place the set is written down, so a typo is a compile error and adding a variant surfaces the branches that don't handle it. Values the *user* types at a call site can still be plain string-literal unions (`format: 'bytes'`, `mode: 'memory'`); the enum is for the SDK's own vocabulary.
- In Python, options the user passes in are `TypedDict`s (plain dict literals at the call site, `Unpack` for kwargs); results the SDK returns are `@dataclass`es (attribute access, immutable where it matters). Don't return bare dicts, and don't make users construct dataclasses for options. Public names in both are snake_case, including when porting a JS type over (`runCmd` → `run_cmd`, `envVars` → `env_vars`).
- Accept the widest input type that works: a Python file-like argument is checked against `IOBase`, not `TextIOBase`/`BufferedReader`, so everything `open()` hands back fits. Group the alternatives with a tuple — `isinstance(data, (str, bytes))`, not chained `or`s.
- Generated OpenAPI and protobuf types never reach the user: map them into SDK-owned dataclasses at the boundary (`SdkType(field=item.api_field, …)`), so regenerating the client can't reshape the public surface. Values the SDK needs but users don't — access tokens, connection identifiers — are underscore-prefixed (`_envd_access_token`) and populated internally during create/connect; they are never `__init__` parameters, because there is no value a user could sensibly pass.
- In TypeScript, data is typed, never classed: options and results are plain object types — `interface` for extensible shapes (`SandboxOpts`, `SandboxInfo`), `type` for unions and intersections (`SandboxState`, `SandboxConnectOpts`). Classes are reserved for things with behavior or a lifecycle (`Sandbox`, `CommandHandle`, `WatchHandle`, paginators, errors).
- Absence is `undefined`, never `null`: optional properties (`?: T`), not `T | null`. Where the API returns `null`, normalize it at the boundary so the union never reaches a consumer.
- Exported enums are plain `enum`, never `const enum`. `const enum` values are inlined at compile time and break every consumer building with `isolatedModules` (Vite, Babel, esbuild) — `FileType` and `FilesystemEventType` shipped that way once and had to be changed back.
- Option types use the `Opts` suffix in both languages (`SandboxConnectOpts`, `FilesystemWriteOpts` in JS; `SandboxOpts`, `SandboxNetworkOpts` in Python) and extend a per-domain base; result types end in `Info`/`Result`/`Metrics`. `Props` is a React word — don't use it.
- The option type is always named and exported from the entry point, never an inline intersection in the signature: `pause(opts?: SandboxPauseOpts)`, not `pause(opts?: ConnectionOpts & { memory?: boolean })`. A named type is discoverable, reusable across the static and instance variants, and `Pick<>`-able by callers; an inline one is none of those.
- When one method can return different shapes, a `format` option selects the shape and typed overloads narrow the return type at the call site: `files.read(path, { format: 'bytes' })` returns `Uint8Array`, `'stream'` a stream, default `'text'` a string. One overloaded method, not `readText`/`readBytes` siblings. Same trick discriminates `commands.run()` — `background: true` returns a `CommandHandle`, otherwise it awaits and returns a `CommandResult`.
- A boolean-discriminated pair needs a third overload for the non-literal case (`{ background?: boolean }` → `CommandHandle | CommandResult`): the two literal overloads don't match a runtime `boolean`, so without it the return type goes unresolved at real call sites. It looks redundant and isn't. Each overload carries its own JSDoc — keeping those per-variant docs is the reason to prefer overloads over inferred conditional return types in the first place.

## Streaming and long-running operations

- Anything open-ended — a running command, a PTY, a directory watch — returns a dedicated `*Handle` class (`CommandHandle`, `WatchHandle`), never a bare stream, promise, or callback registration. Handles come only from SDK factories (`run({ background: true })`, `connect`, `watchDir`); their constructors are `@hidden`/internal.
- Streaming callbacks are named `on<Event>` / `on_<event>` (`onStdout`, `onExit`, `on_pty`) and accept sync or async functions; the event pump awaits each call so a slow consumer applies backpressure instead of buffering unboundedly.
- Sync Python never spawns background threads: the stream is pumped only while the caller blocks, so output callbacks are parameters of `wait()` (unavailable with `background=True`) and `watch_dir` returns a polling handle (`get_new_events()`). JS and async Python pump in the background and take callbacks up front. This is the one sanctioned break in sync/async parity — match it, don't invent hybrids.
- stdout/stderr are incrementally UTF-8-decoded with replacement characters and flushed at stream end; PTY output stays raw bytes (`Uint8Array`/`bytes`).
- What you start, you stop: `handle.stop()`, never `close()`. `close()` reads as releasing a connection, and connection teardown is the only place it belongs. Name what the operation acts on when the bare verb is ambiguous — `files.watchDir(path)` / `watch_dir(path)`, not `files.watch(path)`.

## Control plane and lifecycle

- Two backends, split by responsibility: the REST control plane manages the sandbox *as a resource* (create, kill, pause, list); the in-sandbox envd transport handles everything *inside* a running sandbox (files, commands, pty). A new method's home follows from which side it acts on.
- Destructive or idempotent-transition operations return a boolean instead of throwing when there is nothing to do: `kill` returns `false` on an unknown ID, `pause` returns `false` when already paused, `deleteSnapshot` returns `false` on 404. Reads (`getInfo`, `getMetrics`) throw the typed not-found error instead.
- Batch operations report per-item outcomes rather than failing wholesale: `fork` returns `Array<Sandbox | Error>` / `List[Union[Sandbox, Exception]]`.
- Collections that can grow unboundedly (sandboxes, snapshots) paginate through a `Paginator` object: `list()` is a plain non-async factory, and callers loop `while (paginator.hasNext) await paginator.nextItems()`. Cursor state comes from the `x-next-token` response header.
- That loop is the only way to paginate. Don't add `Symbol.asyncIterator` or `for await` sugar on top — a `while (hasNext) yield* nextItems()` wrapper hides the page boundary the API is built around and has nowhere to put seeking, forwarding, or cancellation. Exhausting a paginator is a caller mistake rather than a sandbox failure, so `nextItems()` past the end throws a plain `Error`/`Exception`, not `SandboxError`/`SandboxException`.
- Python `Sandbox`/`AsyncSandbox` are context managers that `kill()` on exit; JS callers use `try/finally`. Sandbox lifetime is server-authoritative — the SDK never silently renews a timeout in the background.

## Template builder

- The builder is fluent and mutating: each step appends an instruction and returns the builder. Progressive types enforce ordering — `from*` methods start (`TemplateFromImage`), body steps chain (`TemplateBuilder`), and `setStartCmd`/`setReadyCmd` are terminal (`TemplateFinal`).
- Steps are named by intent, not after Dockerfile instructions: `setWorkdir`, `makeDir`, `gitClone`, not `WORKDIR`/`RUN`. High-level steps (`pipInstall`, `aptInstall`, `npmInstall`) are sugar that desugars to `runCmd` with opinionated defaults.
- The builder instance is inert data — anything that touches the network or serializes is a static taking the template as its first argument: `Template.build(template, name, opts)`, `Template.toDockerfile(template)`.
- The serialized wire format uses camelCase keys in both SDKs (`startCmd`, `filesHash`) — Python does not snake_case what goes over the wire. That camelCase is confined to the serialized shapes (`Instruction`, `CopyItem`); the builder methods still take snake_case parameters (`force_upload`, `resolve_symlinks`) and convert on the way in.
- Every site that filters or dispatches on `instruction.type` — hashing, the build upload path, `toDockerfile` — goes through `InstructionType`, per the enum rule above.
- Builder precondition and configuration failures raise `BuildError` / `BuildException`, never a bare `Error` or `ValueError`, and the stack trace has to point at the user's builder call rather than into the SDK.
- Escape anything interpolated into a shell command string — `shellQuote()` in JS, `shlex.quote()` in Python. Not as a security measure (the sandbox is the user's own, and `sudo` inside it is normal), but as a correctness one: an unescaped quote in a JSON config or a path with a space produces a silently broken command. The same applies anywhere else the SDK composes a command string, such as the MCP gateway config.

## Timeouts

Two distinct clocks; never conflate them:

- **Sandbox lifetime**: JS `timeoutMs` in milliseconds, Python `timeout` in seconds. The unit-in-name divergence is deliberate — `Ms` suffix is JS idiom, plain seconds is Python idiom.
- **Per-request**: JS `requestTimeoutMs`, Python `request_timeout`. `0` disables it.
- In JS, every networked method also takes an `AbortSignal` (`signal` on `ConnectionOpts`) so callers can cancel in flight. Don't pass it to `fetch` raw — combine it with the request timeout via `ConnectionConfig.getSignal(requestTimeoutMs, signal)` so either can abort the call. A new API method that forgets to thread `signal` through is a bug.
- Defaults live in named module constants (`DEFAULT_SANDBOX_TIMEOUT_MS`, `REQUEST_TIMEOUT_MS`), never as magic numbers at call sites, and are documented with `@default` in JSDoc / docstrings.
- Streamed reads take a per-chunk idle bound, `streamIdleTimeoutMs` / `stream_idle_timeout`, defaulting to the request timeout; `0` disables it.

## Configuration

- All config resolves through `ConnectionConfig` with the precedence: explicit option → `E2B_`-prefixed env var → default. New knobs follow the same chain and get an `E2B_` env var if they're deployment-level (`E2B_API_KEY`, `E2B_DOMAIN`, `E2B_DEBUG`).
- An env var set to the empty string means unset. In Python that is `os.getenv('E2B_DOMAIN') or DEFAULT_DOMAIN`, never `os.getenv('E2B_DOMAIN', DEFAULT_DOMAIN)` — the two-argument form returns `''` for an exported-but-empty variable, and a blank domain reaches the transport as a malformed URL. (Flag-shaped vars parsed through a comparison, like `E2B_DEBUG`, are fine with a default sentinel.)
- Config objects are immutable snapshots; don't mutate them after construction.
- The server owns validation. Don't add client-side checks for API parameters — types already catch typos, and a duplicated rule drifts from the server's the moment the API changes. Validate only where invalid input would otherwise fail opaquely: the API key format, and metadata/header values whose newlines surface as unreadable transport errors. The key-format check is the one with an opt-out (`validateApiKey` / `validate_api_key` / `E2B_VALIDATE_API_KEY=false`), because self-hosted deployments issue keys in their own format.
- Debug mode (`debug` option / `E2B_DEBUG`) reroutes the control plane and envd to localhost and no-ops lifecycle calls (`kill`, `setTimeout`, metrics). Every new control-plane method must respect it.

## Module and package structure

- One flat entry point per package: everything public is re-exported from `index.ts` / listed in `__init__.py`'s `__all__`; no subpath exports. In JS, runtime values use `export` and type-only names use `export type` — never mixed.
- Behavior that depends on the in-sandbox envd version is gated by named `ENVD_*` threshold constants in `envd/versions` and a semver compare — never an inline version string at the call site.
- The SDK version is never hardcoded: JS imports it from `package.json`, Python reads `importlib.metadata.version("e2b")`.

## Errors

- One base class per domain, and concrete errors subclass it: sandbox errors extend `SandboxError`/`SandboxException`, volume errors extend `VolumeError`, build errors extend `BuildError`. Exception: `AuthenticationError` extends plain `Error` — auth failure is orthogonal to sandbox runtime.
- Prefer specific over generic: throw `SandboxNotFoundError` or `FileNotFoundError`, not their shared `NotFoundError` base class.
- Argument validation that runs before any operation starts throws `InvalidArgumentError` / `InvalidArgumentException` — there is no sandbox or template yet, so a `SandboxError`/`BuildError`/`TemplateError` at that point names something that never existed. Domain errors are for failures of actual domain operations: API calls, sandbox interactions, builder state.
- HTTP status → error class mapping is centralized (`envd/api.ts`), not scattered across call sites. The exception is 404, whose meaning depends on what was asked for: `kill` returns `false`, `getInfo` throws `SandboxNotFoundError`, a file op throws `FileNotFoundError`. Decide it at the call site — but always land inside the `NotFound` hierarchy, so a generic catch still works.
- Detect failure from the HTTP status, not from the presence of an error body: `openapi-fetch` hands back `error: undefined` for a non-2xx with `Content-Length: 0`, so gate on `res.response.ok` / `res.response.status` and fall back to `statusText` for the message. `sandbox.isRunning()` once returned `true` for a 500 because it trusted `res.error`.
- Error messages are actionable: say what to do, not just what failed. Document *when* an error is thrown in JSDoc/docstrings. Thread remote (envd) stack traces into the local error so users see where things broke server-side.
- Two shapes cover the public surface. A misuse error shows the correct call — "Cannot instantiate sandbox directly. Use `await Sandbox.create(...)` instead of `new Sandbox(...)`." A constraint violation states the rule in the option names the user typed — "`onTimeout.keepMemory` is only allowed when action is 'pause'" — never in internal vocabulary like "resolved timeout action". Internal helpers (env parsing, transport plumbing) don't need the treatment.
- Timeout errors must tell the user which knob to turn (see `formatSandboxTimeoutError`), not just that time ran out.

## Deprecation and compatibility

- Deprecated identifiers stay exported as aliases with a clear comment.
- Mark deprecations with JSDoc `@deprecated` (JS) or the `:deprecated:` docstring field (Python), always including the migration path ("Use X instead") and, when applicable, the removal horizon ("will be removed in the next major version").
- Deprecate toward clearer names, not just newer ones (`betaPause`/`beta_pause` → `pause`, `logs` → `logEntries`).
- Experimental surface carries a literal `beta`/`beta_` name prefix (`betaDevContainerPrebuild` / `beta_dev_container_prebuild`), not a flag or separate namespace. Graduation drops the prefix and keeps the prefixed name as a deprecated forwarder (`betaPause` → `pause`).

## Comments and docstrings

- Docstrings and JSDoc are part of the API. Every public method documents its parameters, defaults, and failure modes.
- JS uses JSDoc tags: `@param`, `@returns`, `@default`, `@throws`, `@deprecated`, `{@link}` cross-references, and `@example` with a fenced ```ts code block showing real usage.
- Python uses reST/Sphinx field style: `:param name:`, `:return:`, and `:class:`/inline ``code`` markup.
- A `@returns` that restates the method name documents nothing. `getInfo` returns "the sandbox ID, template ID, metadata, start time, and expected expiration time", not "sandbox information". Where a field name is ambiguous, the docstring is what settles it — `endAt` / `end_at` is the *expected* expiration, not a recorded end.
- A `list()` docstring says it returns a paginator and how to drain it, not that it "lists all sandboxes", and documents `limit` as a maximum *per page* — anything else reads as a total.
- Both halves of a dual method carry a complete docstring. The static `@overload` documents every parameter in its own signature — `domain`, `headers`, `debug`, not just `sandbox_id` — and the `@class_method_variant` instance form documents its params and return too. They render as separate entries, so an omission on either is a hole in the published docs.
