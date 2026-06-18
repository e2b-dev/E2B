<p align="center">
  <img width="100" src="https://raw.githubusercontent.com/e2b-dev/E2B/refs/heads/main/readme-assets/logo-circle.png" alt="e2b logo">
</p>

# E2B CLI

This CLI tool allows you to build manager your running E2B sandbox and sandbox templates. Learn more in [our documentation](https://e2b.dev/docs).

### 1. Install the CLI

**Using Homebrew (on macOS)**

```bash
brew install e2b
```

**Using NPM**

```bash
npm install -g @e2b/cli
```

### 2. Authenticate

```bash
e2b auth login
```

> [!NOTE]
> To authenticate without the ability to open the browser, provide
> `E2B_ACCESS_TOKEN` as an environment variable. You can find your token
> in Account Settings under the Team selector at [e2b.dev/dashboard](https://e2b.dev/dashboard). Then use the CLI like this:
> `E2B_ACCESS_TOKEN=sk_e2b_... e2b template create`.

> [!IMPORTANT]  
> Note the distinction between `E2B_ACCESS_TOKEN` and `E2B_API_KEY`.

### 3. Check out docs

Visit our [CLI documentation](https://e2b.dev/docs) to learn more.

### Environment variables

#### `E2B_ERROR_HANDLER`

When set, the E2B CLI routes process-wide fatal errors to an external executable as a structured JSON payload. This is intended for CI/CD operators who run the E2B CLI as part of a build pipeline and want to forward failures to their own alerting (syslog, webhook, custom script) without parsing stderr.

The handler receives a single JSON argv argument with the following schema:

```ts
{
  schemaVersion: 1,
  reason: 'cli_command_failure' | 'unhandled_rejection' | 'uncaught_exception',
  timestamp: string,  // ISO 8601
  pid: number,
}
```

The `reason` value identifies which fatal path emitted the failure: `cli_command_failure` for command actions inside `main()`, `unhandled_rejection` for rejected promises with no `.catch()` handler, and `uncaught_exception` for synchronous throws outside any try/catch.

The handler is spawned with `shell: false`, `detached: true`, `stdio: 'ignore'`, and only `PATH` is propagated to the child environment. The handler cannot read other E2B runtime secrets (auth tokens, sandbox credentials). The CLI does not wait for the handler to complete before exiting.

Example:

```bash
E2B_ERROR_HANDLER=/usr/bin/logger e2b auth login
# On any fatal failure, the JSON payload is written to syslog via /usr/bin/logger
```

The env var is unset by default, so no behavior change unless an operator opts in.
