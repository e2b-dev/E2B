# e2b CLI (WIP)

Command line interface for [e2b](https://e2b.dev/).

## Installation

```sh
npm install -g @e2b/cli
```

Then you can use the CLI with

```sh
e2b --help
```

You will need to authenticate to use the e2b CLI.

```sh
e2b login
```

<details>
<summary>Authenticate without the ability to open browser</summary>


To authenticate without the ability to open browser, you can provide E2B_ACCESS_TOKEN as an environment variable.
Obtain your E2B_ACCESS_TOKEN from at [e2b.dev/docs](https://e2b.dev/docs).

```sh
E2B_ACCESS_TOKEN=sk_e2b_... e2b login
```

</details>

## Commands

🔜 All commands can be called with a `--path <path-to-dir>` flag that changes the directory where the command will be called, without the need to call `cd`.

```
-V, --version    Display e2b CLI version
-h, --help       display help for command
```

```
help [command]   display help for command

login            Login to e2b
logout           Logout of e2b

env|environment  Manage e2b environments
  create|cr [options]      Create new environment and e2b.json config
  list|ls                  List environments
  shell|cn [options] [id]  Connect terminal to environment
```
