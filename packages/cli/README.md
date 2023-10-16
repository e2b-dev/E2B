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

[E2B](https://e2b.dev) (_english2bits_) is a cloud operating system for AI agents.

This CLI tool allows you to build and manage E2B environments from your terminal.

You define your environment in a `Dockerfile` and then use the CLI to build the environment. You can then connect to the environment via SDKs and run your AI agents.

The `Dockerfile` is the same as for Docker, but you can only use **Debian based linux distros** as the base image.

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

> To authenticate without the ability to open browser, you can provide `E2B_ACCESS_TOKEN` as an environment variable. Get your `E2B_ACCESS_TOKEN` from [e2b.dev/docs](https://e2b.dev/docs). Then use the CLI like this: `E2B_ACCESS_TOKEN=sk_e2b_... e2b build`

2. Create a `Dockerfile` where you describe how your custom E2B environment should look like. Majority of **Debian based linux distros should work as the base image**. Here is an example of a minimal `Dockerfile` for E2B environment:

```Dockerfile
FROM ubuntu:20.04
``` 

3. Run `e2b build` inside the directory with the `Dockerfile` to create and build the environment. You will get **environment ID** that you use for connecting to the environment instances via SDKs and for rebuilding the environment

5. Use the **environment ID** that you got during the `e2b build` with the Python or JS/TS SDK as the `id` to create environment instances

6. Rebuild the environment by running `e2b build <id-of-the-environment>` in the directory with the `Dockerfile`


## Commands

All commands can be called with a `--path <path-to-dir>` flag that changes the directory where the command will be called, without the need to call `cd`.

```sh
-V, --version    Display e2b CLI version
-h, --help       display help for command
```

```sh
Usage: e2b env [options] [command]

Manage e2b environments

Options:
  -h, --help               display help for command

Commands:
  build|bd [options] [id]  Build environment
  list|ls                  List environments
  shell|sh <id>            Connect terminal to environment
  help [command]           display help for command
```
