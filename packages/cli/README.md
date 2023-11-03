<h1 align="center">
<span style="font-size:48px;"><b>E2B CLI</b></span>
</h1>

<h4 align="center">
  <a href="https://e2b.dev/docs">Docs</a> |
  <a href="https://e2b.dev">Website</a> |
  <a href="https://discord.gg/U7KEcGErtQ">Discord</a> |
  <a href="https://twitter.com/e2b_dev">Twitter</a>
</h4>

<h4 align="center">
  <a href="https://discord.gg/U7KEcGErtQ">
    <img src="https://img.shields.io/badge/chat-on%20Discord-blue" alt="Discord community server" />
  </a>
  <a href="https://twitter.com/e2b_dev">
    <img src="https://img.shields.io/twitter/follow/infisical?label=Follow" alt="e2b Twitter" />
  </a>
</h4>

[E2B](https://e2b.dev) (_english2bits_) is a cloud operating system for AI
agents.

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
   build the sandbox template. You will get * _template ID_* that you use for
   connecting to the sandbox via SDKs and for rebuilding the sandbox template

4. Use the **template ID** that you got during the `e2b build` with the Python
   or JS/TS SDK as the `id` to create sandbox

5. Rebuild the sandbox template by running `e2b build <id-of-the-template>` in
   the directory with the `Dockerfile`

## Commands

All commands can be called with a `--path <path-to-dir>` flag that changes the
directory where the command will be called, without the need to call `cd`.

```sh
-V, --version    Display E2B CLI version
-h, --help       display help for command
```

```sh
Usage: e2b template [options] [command]

Create sandbox templates from Dockerfiles by running e2b build then use our SDKs to create
sandboxes from these templates.

Visit E2B docs (https://e2b.dev/docs) to learn how to create sandbox templates
and start sandboxes.

Options:
  -h, --help               display help for command

Commands:
  build|bd [options] [id]  Build sandbox template defined by ./e2b.Dockerfile or
                           ./Dockerfile in root directory. By default the root directory is the
                           current working directory. This command also creates e2b.toml config

  list|ls                  List sandbox templates

  shell|sh <id>            Connect terminal to sandbox

  init|it [options]        Create basic E2B ./e2b.Dockerfile in root directory. You can then run
                           e2b build to build sandbox template from this Dockerfile

  help [command]           display help for command
```
