<p align="center">
  <img width="100" src="/readme-assets/logo-circle.png" alt="e2b logo">
</p>

<h1 align="center">
  E2B CLI
</h1>

This CLI tool allows you to build and manage E2B sandbox templates.

You define your sandbox template with an `e2b.Dockerfile` and then use the CLI `e2b template build` to build the sandbox template.
You can then create a sandbox from a template with E2B SDKs and run your AI agents or execute code.

The `e2b.Dockerfile` is the same as for Docker, but you can only use **Debian-based Linux distros** as the base image.

## Installation

```bash
npm install -g @e2b/cli
```

Then you can use the CLI like this:

```bash
e2b --help
```

## Getting started

1. Authenticate with `e2b auth login`

> To authenticate without the ability to open the browser, provide
> `E2B_ACCESS_TOKEN` as an environment variable. Get your `E2B_ACCESS_TOKEN`
> from [e2b.dev/docs](https://e2b.dev/docs). Then use the CLI like this:
> `E2B_ACCESS_TOKEN=sk_e2b_... e2b build`.

2. Create an `e2b.Dockerfile` where you describe how your custom E2B sandbox template should look like. The majority of **Debian-based Linux distros should work as the base image**. Here is an example of a minimal `Dockerfile` for an E2B sandbox template:

```Dockerfile
FROM ubuntu:22.04
```

3. Run `e2b template build` inside the directory with the `e2b.Dockerfile` to create and build the sandbox template. You will get the _*template ID*_ to use for creating sandboxes with E2B SDKs. The `e2b.toml` file will be created automatically in the same directory

4. Use the **template ID** that you got during the `e2b template build` with the Python or JS/TS SDK as the `id` to create a sandbox

5. Rebuild the sandbox template by running `e2b template build` in the directory with the `e2b.Dockerfile` and `e2b.toml` files

## Commands

All commands can be called with a `--path <path-to-dir>` flag that changes the
directory where the command will be called without the need to call `cd`.

```md
-V, --version Display E2B CLI version
-h, --help display help for command
```
