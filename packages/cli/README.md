# e2b CLI
CLI for managing Devbook environments.

An environment is a virtual machine image that you can customize through our CLI. You can add files, install dependencies, and set env vars in the environment. Then with Devbook, every user visiting your website will get a new copy of the environment they can use.

* [Installation](#installation)
* [Quickstart](#quickstart)
* [Commands](#commands)
  + [`devbook env create`](#devbook-env-create)
  + [`devbook env push`](#devbook-env-push)
  + [`devbook env publish`](#devbook-env-publish)
  + [`devbook env delete`](#devbook-env-delete)
  + [`devbook env use`](#devbook-env-use)
  + [`devbook env set`](#devbook-env-set)
  + [`devbook env connect`](#devbook-env-connect)
  + [`devbook env list`](#devbook-env-list)
* [`dbk.toml` config](#dbktoml-config)
  + [`id`](#id)
  + [`template`](#template)
  + [`title`](#title)
  + [`filesystem.local_root`](#filesystemlocal_root)
* [FAQ](#faq)
  + [Inspect how a published environment looks like](#inspect-how-a-published-environment-looks-like)
  + [Delete files from an environment](#delete-files-from-an-environment)
  + [Inspect files in an environment](#inspect-files-in-an-environment)
  + [Install dependencies in an environment](#install-dependencies-in-an-environment)
  + [Upload local files to an environment](#upload-local-files-to-an-environment)


## Installation
```sh
npm install -g @devbookhq/cli
```

Then you can use the CLI with
```sh
devbook env --help
```

You will need an API key to use the Devbook CLI — you can get it [here](https://dash.usedevbook.com/settings) after signing up. 
After you get the API key set the `DEVBOOK_KEY` env var in your terminal, or call the CLI with the env var directly

```sh
DEVBOOK_KEY=<your-api-key> devbook env ...
```

## Quickstart
```sh
# Create an environment and a dbk.toml config for the environment
devbook env create

# Create a directory for files you want to be in the environment
mkdir ./files

# Upload files from the ./files directory to the environment
devbook env push

# Connect terminal to the environment so you can install dependencies. 
# You quit this terminal with Ctrl+D or by `exit` command
devbook env connect

# All changes you made to the environment so far are not published —
# users that use this environment on your website cannot see the changes.
# To make all the changes you just made published, call the following command
devbook env publish
```

## Commands
By default, commands are referring to an environment defined by a `dbk.toml` in a directory where you called the commands.

All commands can be called with a `--path <path-to-dir>` flag that changes the directory where the command will be called, without the need to call `cd`.


The Devbook CLI has following commands

### `devbook env create`
Create a new environment and `dbk.toml` config. 

You can specify another environment as a template with `--template <existing-environment-id>` flag. This existing environment will be a base of the new environment — all files, env vars and dependencies from the existing environment will be present in the new environment.


### `devbook env push`
Upload files from a local directory to an environment. The local directory to upload from is defined by the `filesystem.local_root` field in the `dbk.toml` config (`./files` by default).
Path of uploaded files in the environment will reflect their paths in the `./files` directory — file `./files/index.ts` will become `/index.ts` in the environment.

> Use `devbook env publish --all` to push all environments in subdirectories.


### `devbook env publish`
Publish changes you made in an environment (uploaded files, installed depedencies, set env vars).
Users on your website that use the environment cannot see the new changes you made to the environment until you run `devbook env publish` command.

> Use `devbook env publish --all` to publish all environments in subdirectories.


### `devbook env delete`
Delete an environment and a `dbk.toml` config for the environment.


### `devbook env use`
Create a `dbk.toml` for an existing environment. You can use this to start version tracking environments created through Devbook dashboard.


### `devbook env set`
Set env vars inside of an environment.
For example, to set `FOO` and `BAR` call `devbook env set FOO=1 BAR=2`.

> You must set all env vars in one `devbook env set --env-vars <KEY=VALUE...>` call — variables from the previous `devbook env set` calls will be overwritten.


### `devbook env connect`
Open a terminal connected to an environment that you can use to configure and inspect the environment.

> The environments are based on Alpine Linux that uses `apk add` and `apk del` for managing packages.


### `devbook env list`
List all environments and paths to their `dbk.toml` configs (if the configs are in subdirectories of the current directory).


## `dbk.toml` config
The `dbk.toml` config is used for tracking an environment in version control. It is created automatically by `devbook env create` command.

The following fields are in each `dbk.toml` config

### `id` 
You **should not edit this field** manually.
The id of this environment.


### `template` 
You **should not edit this field** manually.
The id of the environment that was used as a template for this environment.


### `title`
Title of the environment. The title is used for easier navigation and to distinguish between environments.

By default the title is the name of the directory where you called `devbook env create` command.
You can change this field and use `devbook env push` to save the changes.


### `filesystem.local_root`
A directory containing files that will be uploaded with `devbook env push` command. 
By default it is `./files` — that means that the `./files` directory next to this `dbk.toml` will be uploaded to the environment when you use `devbook env push`.

For example, if you have a `./files/index.ts` file locally and run `devbook env push` the file `/index.ts` will be created and saved in the environment.


## FAQ

### Inspect how a published environment looks like
Use `devbook env connect --published` to open a terminal connected to a new instace of the environment.


### Delete files from an environment
Use `devbook env connect` to open a terminal connected to the environment. Then you can delete the files from the environment with `rm` shell command.


### Inspect files in an environment
Use `devbook env connect` to connect your terminal with the environment then use terminal commands like `ls`, `cd`, `cat`, etc. to inspect files.


### Install dependencies in an environment
Use `devbook env connect` to open a terminal connected to the environment. Then you can install dependencies as you would on any other Linux machine.

> The environments are running on Alpine Linux that uses `apk add` and `apk del` for managing packages.


### Upload local files to an environment
Create `./files` directory next to the `dbk.toml` and put the files you want in the environment there.
After you call `devbook env push` files from the `./files` directory will be uploaded to the environment. Their path in the environment will reflect the path in the `./files` directory — file `./files/index.ts` will become `/index.ts` in the environment.
