# Devbook CLI
CLI for managing Devbook environments.

Environment is virtual machine image that you can customize through our CLI. You can add files, install dependencies, and set env vars in the environment. Then with Devbook, every user visiting your website will get a new copy of the environment they can use.


## Installation
```sh
npm install -g @devbookhq/cli
```

Then you can use the CLI:
```sh
devbook env --help
```

You will need an API key to use the Devbook CLI — you can get it [here](https://dash.usedevbook.com/settings) after signing up. You then set the `DEVBOOK_KEY` env var in your terminal config, or you call the CLI with the env var directly: `DEVBOOK_KEY=<your-key> devbook env ...`.

## Quickstart
```sh
# Create environment and dbk.toml config for the environment
devbook env create

# Create directory for files you want to be in the environment
mkdir ./files

# Upload files from the ./files directory to the environment
devbook env push

# Connect terminal to the environment so you can install dependencies. 
# You quit this terminal with Ctrl+D or by `exit` command.
devbook env connect

# All changes you made to the environment so far are not published —
# users that use this environment on your website cannot see them.
# To make all the changes you just made published, call the following command
devbook env publish
```

## Commands
By default, commands are referring to the environment defined by a `dbk.toml` in the directory where you called the command.

All commands can be called with a `--path <path-to-dir>` flag that changes the directory where the command will be called, without the need to call `cd`.


The Devbook CLI has following commands:

### `devbook env create`
Create an environment and `dbk.toml` config. 

You can specify another environment as a template with `--template <existing-environment-id>` flag. That environment will be the base of the new environment — all files, env vars and dependencies from the existing environment will be present in the new environment.


### `devbook env push`
Upload the files from the directory defined in the `filesystem.local_root` field of `dbk.toml` config, to the environment (`./files` by default).
Path of the uploaded files in the environment will reflect their path in the `./files` directory — file `./files/index.ts` will become `/index.ts` in the environment.

> Use `devbook env publish --all` to push all environments in subdirectories.


### `devbook env publish`
Publish the unpublished changes you made in the environment (uploaded files, installed depedencies, set env vars).
Users on your website that use the environment cannot see the new changes you made to the environment until you run the `devbook env publish` command.

> Use `devbook env publish --all` to publish all environments in subdirectories.


### `devbook env delete`
Delete the environment and the `dbk.toml` config for the environment.


### `devbook env use`
Create a `dbk.toml` for an existing environment. You can use this to start version tracking environments created through the dashboard.


### `devbook env set --env-vars <KEY=VALUE...>`
Set env vars inside of the environment.
For example, to set `FOO` and `BAR` call `devbook env set FOO=1 BAR=2`.

> You must set all env vars in one `devbook env set --env-vars <KEY=VALUE...>` call — the variables from the previous `devbook env set` calls will be overwritten.


### `devbook env connect`
Open a terminal connected to the environment that you can use to configure and inspect the environment through the terminal.

> The environments are based on Alpine Linux that uses `apk add` and `apk del` for managing packages.


### `devbook env list`
List all environments and paths to their `dbk.toml` configs if they are in subdirectories of the current directory.


## `dbk.toml` config
The `dbk.toml` config is used for tracking an environment in version control. It is created automatically by the `devbook env create` command.

> You can freely move the `dbk.toml` config and rename the directory the config is in. Just make sure to move the `./files` directory.

> You should have only one `dbk.toml` config for each environment.

The following fields are in each `dbk.toml` config:

### `id` 
You **should not edit this field** manually.
The id of this environment.


### `template` 
You **should not edit this field** manually.
The id of the environment that was used as a template for this environment.


### `title`
Title of the environment. The title is used for easier navigation and to distinguish between environments.

By default the title is the name of the directory where you called the `devbook env create` command.
You can change this field and use the `devbook env push` to save the changes.


### `filesystem.local_root`
Directory containing files that will be uploaded with `devbook env push` command. By default it is `./files` — that means that the `./files` directory next to this `dbk.toml` will be uploaded to the environment when you use `devbook env push`.

For example, if you have a `./files/index.ts` file locally and run `devbook env push` the file `/index.ts` will be created and saved in the environment.


## FAQ

### Inspect how the published environment looks like
Use `devbook env connect --published` to open a terminal connected to a new instace of the environment.


### Delete files from environment
Use `devbook env connect` to open a terminal connected to the environment. Then you can delete the files from the environment with `rm` shell command.


### Inspect files inside of the environment
Use `devbook env connect` to connect your terminal with the environment then use terminal commands like `ls`, `cd`, `cat`, etc. to inspect files.


### Install dependencies inside environment
Use `devbook env connect` to open a terminal connected to the environment. Then you can install dependencies as you would on any other Linux machine.

> The environments are running on Alpine Linux that uses `apk add` and `apk del` for managing packages.


### Upload local files to environment
Create `./files` directory next to the `dbk.toml` and put the files you want in the environment there.
After you call the `devbook env push` files from the `./files` directory will be uploaded to the environment. Their path in the environment will reflect the path in the `./files` directory — file `./files/index.ts` will become `/index.ts` in the environment.