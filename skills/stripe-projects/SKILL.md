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
- Do not print secret values. If the managed `.env` has already been pulled by Stripe Projects, read only the needed variables into the command environment without echoing them.

```bash
stripe projects env --pull --yes
E2B_API_KEY="$(awk -F= '$1=="E2B_API_KEY"{print substr($0, index($0,"=")+1)}' .env)" \
  e2b sandbox create --detach
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

Export the E2B API key before using the E2B CLI or SDK. Prefer reading credential output as data instead of sourcing a `.env` file:

```bash
stripe projects env --json
export E2B_API_KEY="<api_key from the E2B access_configuration>"
```

In raw resource output, map `access_configuration.api_key` to `E2B_API_KEY`. If credentials were already pulled into a local `.env`, copy only the `E2B_API_KEY` value into the environment explicitly. Do not source `.env` as shell code.

## E2B CLI

The E2B CLI is intentionally small. Use it for the common operational loop:
create a sandbox, run commands inside it, inspect/list/pause/resume/kill sandboxes,
and leave long-running processes in the background. Do not spend time looking for
CLI flags for every SDK option; if a task needs lifecycle controls, custom
timeouts, metadata, or auto-resume, use the SDK.

For normal agent tasks, start with the default CLI settings. A detached sandbox
plus `sandbox exec` is usually enough, and you do not need to adjust timeout or
lifecycle settings unless the user asks for persistence beyond the default
session behavior.

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

## Fast path: general sandbox task

When the user asks to do work in a sandbox, use this flow unless the task needs
a more specific SDK feature:

1. Pull credentials, create a detached sandbox, and keep the sandbox ID.
2. Use `sandbox exec -- bash -lc '...'` to install files, run scripts, and inspect state.
3. For persistent processes inside the running sandbox, use `nohup ... &` and write a PID file.
4. For HTTP services, listen on a known port, build the public URL as `https://<port>-<sandbox_id>.<E2B_DOMAIN>`, and probe it before returning it.
5. Stay on default timeout/lifecycle settings for ordinary tasks. Use the SDK only when the user explicitly needs longer persistence, auto-resume, metadata, or another option the CLI does not expose.

Copyable command pattern:

```bash
stripe projects env --pull --yes
export E2B_API_KEY="$(awk -F= '$1=="E2B_API_KEY"{print substr($0, index($0,"=")+1)}' .env)"
export E2B_DOMAIN="$(awk -F= '$1=="E2B_DOMAIN"{print substr($0, index($0,"=")+1)}' .env)"

SANDBOX_ID="$(e2b sandbox create --detach | awk '/Sandbox created with ID/{print $5}')"

e2b sandbox exec "$SANDBOX_ID" -- bash -lc '
  mkdir -p /home/user/work
  cd /home/user/work
  cat > index.html <<EOF
<!doctype html>
<html><head><meta charset="utf-8"><title>Sandbox work</title></head>
<body><h1>Sandbox work</h1></body></html>
EOF
  nohup python3 -m http.server 8080 >server.log 2>&1 &
  echo $! >server.pid
'

URL="https://8080-${SANDBOX_ID}.${E2B_DOMAIN}"
curl -I --max-time 12 "$URL"
printf '%s\n' "$URL"
```

Notes:

- The E2B CLI requires `--` before shell flags: `e2b sandbox exec <id> -- bash -lc '...'`.
- The public port URL pattern works for an HTTP server listening on the matching port inside the sandbox.
- The base template has Python available, so static HTTP pages and simple scripts do not need npm or a framework unless requested.
- Use default timeout/lifecycle behavior for routine work. If the sandbox must live longer or resume later, call `Sandbox.connect(id).set_timeout(seconds)` or create it with lifecycle options from the SDK.

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
