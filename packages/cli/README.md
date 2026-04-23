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
> `E2B_ACCESS_TOKEN=sk_e2b_... e2b template build`.

> [!IMPORTANT]  
> Note the distinction between `E2B_ACCESS_TOKEN` and `E2B_API_KEY`.

### 3. Common sandbox commands

Create a sandbox from the default template:

```bash
e2b sandbox create
```

Create a sandbox from a specific template without attaching a terminal:

```bash
e2b sandbox create my-template --detach
```

List running sandboxes:

```bash
e2b sandbox list
```

List running and paused sandboxes, limited to 20 results:

```bash
e2b sandbox list --state running,paused --limit 20
```

Filter sandboxes by metadata and print JSON:

```bash
e2b sandbox list --metadata owner=agent --format json
```

Inspect a sandbox:

```bash
e2b sandbox info <sandboxID>
```

Connect an interactive terminal to a running sandbox:

```bash
e2b sandbox connect <sandboxID>
```

Stream sandbox logs until the sandbox closes:

```bash
e2b sandbox logs <sandboxID> --follow
```

Filter logs by level or logger prefix:

```bash
e2b sandbox logs <sandboxID> --follow --level warn
e2b sandbox logs <sandboxID> --format json --loggers Envd,Kernel
```

View live resource metrics:

```bash
e2b sandbox metrics <sandboxID> --follow
```

Run a command in a running sandbox:

```bash
e2b sandbox exec <sandboxID> -- pwd
e2b sandbox exec <sandboxID> -- python -V
```

Pass environment variables to a sandbox command:

```bash
e2b sandbox exec <sandboxID> -e FOO=bar -- sh -lc 'echo $FOO'
```

Pipe stdin into a sandbox command:

```bash
cat script.py | e2b sandbox exec <sandboxID> -- python
```

Use `--` before the remote command when you want to clearly separate CLI flags from the command being executed inside the sandbox.

### 4. Check out docs

Visit our [CLI documentation](https://e2b.dev/docs) to learn more.
