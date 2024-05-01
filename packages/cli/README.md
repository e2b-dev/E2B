<h1 align="center">
  E2B CLI
</h1>

This CLI tool allows you to build and manage E2B sandbox templates from your
terminal.

You define your sandbox template in a `Dockerfile` and then use the CLI to build
the sandbox template. You can then connect to the sandbox template via SDKs and
run your AI agents.

The `Dockerfile` is the same as for Docker, but you can only use **Debian based
linux distros** as the base image.

## Installation

```bash
npm install -g @e2b/cli
```

Then you can use the CLI like this:

```bash
e2b --help
```

## Getting started

1. Authenticate with `e2b login`

> To authenticate without the ability to open browser, you can provide
> `E2B_ACCESS_TOKEN` as an environment variable. Get your `E2B_ACCESS_TOKEN`
> from [e2b.dev/docs](https://e2b.dev/docs). Then use the CLI like this:
> `E2B_ACCESS_TOKEN=sk_e2b_... e2b build`

2. Create a `Dockerfile` where you describe how your custom E2B sandbox template
   should look like. Majority of **Debian based linux distros should work as the
   base image**. Here is an example of a minimal `Dockerfile` for E2B sandbox
   template:

```Dockerfile
FROM ubuntu:22.04
```

3. Run `e2b build` inside the directory with the `Dockerfile` to create and
   build the sandbox template. You will get *_template ID_* that you use for
   connecting to the sandbox via SDKs and for rebuilding the sandbox template

4. Use the **template ID** that you got during the `e2b build` with the Python
   or JS/TS SDK as the `id` to create sandbox

5. Rebuild the sandbox template by running `e2b build <id-of-the-template>` in
   the directory with the `Dockerfile`

## Commands

All commands can be called with a `--path <path-to-dir>` flag that changes the
directory where the command will be called, without the need to call `cd`.

```md
-V, --version    Display E2B CLI version
-h, --help       display help for command
```
