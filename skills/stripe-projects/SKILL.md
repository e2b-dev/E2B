---
name: stripe-projects
description: "Use after E2B sandbox/API access has been provisioned through Stripe Projects and the user needs to use the resulting E2B API key with the E2B CLI, JavaScript SDK, Python SDK, or Code Interpreter SDK."
---

# E2B Stripe Projects

Use these patterns after E2B sandbox/API access has been provisioned through Stripe Projects.

## Credentials

- Stripe Projects provisions E2B sandbox/API access and returns an E2B team API key.
- Use that key as `E2B_API_KEY` for sandbox creation, sandbox control, and SDK clients.
- Prefer setting `E2B_API_KEY` explicitly in runtime environments so commands and SDK calls use the intended E2B team.
- Local defaults can also come from `.env.local` or `~/.e2b/config.json`.
- In Stripe Projects checkouts, the E2B CLI may not be globally logged in. Before using `e2b sandbox ...`, prefer a Stripe Projects env pull plus per-command export instead of trying `e2b auth login`.
- Do not print secret values. `stripe projects env --json` can return redacted placeholders, so do not use it as the source for a runnable `E2B_API_KEY`. Pull the managed env file, then read only the needed E2B variables into the command environment without echoing them.

```bash
stripe projects env --pull --yes
env_value() {
  awk -F= -v key="$1" '$1 == key {sub(/^[^=]*=/, ""); gsub(/^"|"$/, ""); print; exit}' .env
}
export E2B_API_KEY="$(env_value E2B_API_KEY)"
export E2B_API_URL="$(env_value E2B_API_URL)"
export E2B_DOMAIN="$(env_value E2B_DOMAIN)"
e2b sandbox create base --detach
```

## Stripe Projects CLI

Add E2B to the current Stripe project:

```bash
stripe projects add e2b/sandboxes
```

Inspect or pull provisioned credentials:

```bash
stripe projects env
stripe projects env --json
stripe projects env --pull --yes
```

Export the E2B API key before using the E2B CLI or SDK. Prefer `stripe projects env --pull --yes` for command execution because JSON output may redact secret values. Read only the variables you need from `.env`; do not source `.env` as shell code:

```bash
stripe projects env --pull --yes
env_value() {
  awk -F= -v key="$1" '$1 == key {sub(/^[^=]*=/, ""); gsub(/^"|"$/, ""); print; exit}' .env
}
export E2B_API_KEY="$(env_value E2B_API_KEY)"
export E2B_API_URL="$(env_value E2B_API_URL)"
export E2B_DOMAIN="$(env_value E2B_DOMAIN)"
```

Use `stripe projects env --json` for structure checks only. In current Stripe Projects output, the E2B variables are under `data.resource_access_configurations[].access_configuration`, including `E2B_API_KEY`, `E2B_API_URL`, and `E2B_DOMAIN`, but the values may be redacted and unusable for CLI/SDK calls.

## E2B CLI

Install the E2B CLI with npm:

```bash
npm install -g @e2b/cli
```

Prefer detached sandboxes for non-interactive work so the command returns a sandbox ID and does not attach an interactive terminal:

```bash
e2b sandbox create --detach
e2b sandbox create base --detach
```

Run shell commands in a sandbox with `--` before shell flags so the CLI does not parse them:

```bash
e2b sandbox exec <sandbox_id> -- bash -lc 'pwd && ls -la'
```

For long-running processes, run them in the background and write a PID file in the sandbox:

```bash
e2b sandbox exec <sandbox_id> -- bash -lc 'nohup python server.py >server.log 2>&1 & echo $! >server.pid'
```

The CLI has explicit resume, but sandbox creation does not currently expose an auto-resume flag:

```bash
e2b sandbox resume <sandbox_id>
```

Use `sandbox exec` for operational commands against an existing sandbox:

```bash
e2b sandbox exec <sandbox_id> -- bash -lc 'python --version'
e2b sandbox exec <sandbox_id> -- bash -lc 'ls -la /tmp'
```

## JavaScript SDK

Use `Sandbox.create()` with `E2B_API_KEY` for a fresh sandbox:

```ts
import Sandbox from 'e2b'

const sandbox = await Sandbox.create('base')
const result = await sandbox.commands.run('echo "hello from e2b"')
console.log(result.stdout)
```

Use lifecycle options when the sandbox should pause on timeout and resume on later activity:

```ts
const sandbox = await Sandbox.create('base', {
  lifecycle: { onTimeout: 'pause', autoResume: true },
})
```

Use `Sandbox.connect()` when a CLI step already created the sandbox:

```ts
import Sandbox from 'e2b'

const sandbox = await Sandbox.connect(process.env.SANDBOX_ID!)
const result = await sandbox.commands.run('cat important_file.md')
console.log(result.stdout)
```

## Python SDK

Use the context manager with `E2B_API_KEY` for short-lived tasks:

```py
from e2b import Sandbox

with Sandbox.create("base") as sandbox:
    result = sandbox.commands.run('echo "hello from e2b"')
    print(result.stdout)
```

Use lifecycle options when the sandbox should pause on timeout and resume on later activity:

```py
sandbox = Sandbox.create(
    "base",
    lifecycle={"on_timeout": "pause", "auto_resume": True},
)
```

For workflows that share a sandbox across steps, keep the sandbox ID and connect to it later:

```py
from e2b import Sandbox

sandbox = Sandbox.connect(sandbox_id)
result = sandbox.commands.run("cat important_file.md")
print(result.stdout)
```

## Practical Defaults

- Use the `base` template unless a task requires a specific template.
- Prefer `bash -lc` for multi-command CLI execution.
- Put temporary files under `/tmp` or the current working directory inside the sandbox unless the task requires a specific path.
- For workloads that need code execution with `run_code` or `runCode`, use the Code Interpreter SDK.
