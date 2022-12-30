# Devbook CLI
CLI for managing Devbook environments.

## Installation

```sh
npm install -g @devbookhq/cli
```

## Quick overview
- You can create “environments” on our backend — they are images of VMs that are then used to create separate environment instances when users come to your playground
- You create these environments via the CLI — with `devbook env create` command. The command also creates a `dbk.toml` config that references this environemnt. That is used to defined setup like “I want this local directory to be uploaded” and to keep track about the environments via git
- You can base environment on another existing environment by using `devbook env create --template <baseEnvID>` command flag — this way you don’t have to setup language servers, postgres, etc everytime you create a new environment
- You need to publish the env with `devbook env publish`, while in the dir with the config, to make the changes publicly visible
- If you want to add new files, create a directory alongside the config that has the same name as the directory mentioned in the config field `local_root = "./files"` (here it is `files`). This directory will be uploded with the `devbook env push` command. The terminal in the plaground starts in the `/code` directory so you need to put your actual files in the local filesystem to the `files/code`  directory
- Deleting files from the env right now is a little more complicated — you need to use `devbook env connect`, while in the dir with the config, to “ssh” into the environment. There you can use the terminal to delete files. After disconnecting you also need to **publish the changes**!
- You need to take the environment's `id` (copy it from the config for example) and use it in the config for your playground


## Usage

```sh
devbook env <command>
```

> You can use `dbk` instead of `devbook` as a shorthand for the Devbook CLI.

### What is an environment
Environment is a VM image that you create on our backend. You can upload files, set env vars, and install dependencies through a terminal connected to this image by using `devbook env push`, `devbook env set`, and `devbook env connect` commands from the Devbook CLI.
After you customize the environment with these command you can publish the environment to make it publicly acessible with the `devbook env publish` command.

> Each user that visits your playground powered by Devbook gets their own instance of the environment. This instance is created from the VM image (environment) that you created and customized. 


### What is a published environment
If you make a change to environment the change is not automatically visible to users when they open the playground. Every time you make a change and you want that change to be visible to the users of your playground you need to call `devbook env publish`.


### Use environment in a playground
You are using the environment's `id` (that can be found in the `dbk.toml`) to identify which environment should the user of your playground see. The environment instance is started through our SDK, but most of the time you will be specifying the `id` through `environmentID` in the content config files.


### Signing in/getting your Devbook API key
You need an API key to use the Devbook CLI - you can get it [here](https://dash.usedevbook.com/settings) after signing up. You then set the `DEVBOOK_KEY` env var in your terminal config or you call the CLI with the env var directly: `DEVBOOK_KEY=<your-key> devbook env ...`.


### How is the Dashboard (https://dash.usedevbook.com) and Devbook CLI related
You use the same account for both and you can access environments created in one them in the other without any limitations.
We recommend using the CLI though because it enables a better development flow using version tracing systems and some operations are tedious to do via the dashboard.


### What is `dbk.toml` config
`dbk.toml` is a file created by the Devbook CLI that allows you to use version control (and therefore CI/CD) to keep track of the environment you are using. 
It also allows you to easily upload files defined in the config to the environment.


### Create a new environment
Use `devbook env create` in the directory where you want the `dbk.toml` config to be. You will be prompted to choose the template and title for the environment.


### What is a template
You can base environment on another existing environment by using `devbook env create --template <baseEnvID>` command flag — this way you don’t have to setup language servers, postgres, etc., everytime you create a new environment


### What to do after deleting `dbk.toml`
If you want to also delete the environment you can use `devbook env delete [id]`. If you want to recreate the environment's config use `devbook use [id]`.

> If you call `devbook env delete` the `dbk.toml` is also automatically deleted.


### How to start using CLI with an environment created in dashboard
Call `devbook env use --select` in a directory where you want to create the `dbk.toml` and then choose the environment from the provided list.


### Can I have multiple `dbk.toml` configs for the same environment
We don't recommend that - ideally you should have only one `dbk.toml` for each environment (that is also tracked in version control).


#### Change environment title
Edit the `title` in the `dbk.toml` then run `devbook env push`


### Save files from repository to environment
Create `./files` directory next to the `dbk.toml` and put the files you want in the environment there. After you call the `devbook env push` the files from the `./files` directory will be uploaded to the environment. Their path in the environment will reflect the path in the `./files` directory - file `./files/index.ts` will become `/index.ts` in the environment.

> You can customize the name and path to the `./files` (default) directory by editing the `filesystem.local_root` field in `dbk.toml` config.


### Install dependencies inside environment
Use `devbook env connect` to open a terminal connected to the environment. There you can install dependencies as you would on any other Linux machine.

> The environments are running on Alpine Linux that uses `apk add` and `apk del` for managing packages.


### Make the latest environment changes publicly available
Use `devbook env publish` in the directory with the `dbk.toml`.


### Delete environment
Use `devbook env delete` in the directory with the `dbk.toml`. This will delete both the environment and the `dbk.toml` config file. Other files are not modified.


### Inspect files inside of the environment
Use `devbook env connect` to connect your terminal with the environment then use normal terminal commands like `ls`, `cd`, `cat`, etc. to inspect files.


### Setting env vars inside environment
Use `devbook env set --env-vars <KEY=VALUE...>` to set 


### Delete files from environment
Use `devbook env connect` to open a terminal connected to the environment. There you can delete the files from the filesystem by using `rm` shell command.


### List all environments
Use `devbook env list` to list all environments associated with your account.


### Find environment configs inside repository
Use `devbook env list` in the repository root directory - it will automatically scan subdirectories for `dbk.toml` configs. If you don't want to scan the subdirectories and you want only to list the environments associated with the current account add `--no-local` flag to the `devbook env list --no-local` command.


### Inspect how the publicly available environment looks like right now
Use `devbook env connect --published` to open a terminal connected to a new instace of the published environment.


### Publish all environments with configs in a repository
Use `devbook env publish --all` in the root of the repository to publish all environment that have `dbk.toml` in this repository.


### Push all environments with configs in a respository
Use `devbook env push --all` in the root of the repository to push all environment that have `dbk.toml` in this repository.


## Commands

> Commands have a two character shorthand

By default, all commands are using the environment defined by a `dbk.toml` from the directory you called the command in.
In several command you can override this by adding an optional argument `[id]` right after the `env` command.
All commands can also be called with a `--path <path-to-dir>` flag that changes the directory where the command will be called, without the need to call `cd`.

The Devbook CLI has following commands:

### `env create`
Creates an environment and `dbk.toml` config. You can specify another environment as a template with `--template <existing-env-id>` flag and this environment's published image will be used as a starting image for this environment.
If you don't specify the template you will be prompted to choose from a predefined templates (Nodejs, Go, etc.).

### `env push`
Upload the files from the directory defined in config `filesystem.local_root` to the environment. Their path in the environment will reflect the path in the `./files` directory - file `./files/index.ts` will become `/index.ts` in the environment.

### `env publish`
Make the latest changes to in the environment publicly visible.

### `env delete`
Delete the environment and it's `dbk.toml`.

### `env use`
Create a `dbk.toml` for an existing environment. You can use this if you want to start version tracking environment created through the dashboard.

### `env set --env-vars <KEY=VALUE...>`
Set env vars inside of the environment.
For example `devbook env set FOO=1 BAR=2`.

> You must set all env vars in one `env set --env-vars <KEY=VALUE...>` call - the variables from the previous `env set` calls will be always overwritten.

### `env connect`
Open a terminal connected to the environment which you can use to configure and inspect the environment.


### `env list`
List all environment for this account and path to their `dbk.toml` configs if they are in subdirectories of the current directory.


## Config
The `dbk.toml` config is used for tracking your environments through version control. It is created automatically by the `env create` command.

> You can freely move the `dbk.toml` config and rename the directory the config is in. Just make sure to also move the `./files` directory.

The following fields are in each `dbk.toml` config:

### `id` 
You **should not edit this field** manually.
The id of this environment.

### `template` 
You **should not edit this field** manually.
The original environment's id that was used as a template for this environment.

### `title`
Title of the environment. This is used for easier navigation and to distinguish between environment. By default the title is the name of the directory where you called the `env create` command.
You can change this field and use the `env push` to save the changes on our backend.

### `filesystem.local_root`
Directory used for the `env push` command. By default it is `./files` - that means that the `./files` directory next to this `dbk.toml` will be uploaded to the environment when you use `env push`. 
For example, if you have a `./files/index.ts` file and run `env push` the file `/index.ts` will be created and saved in the environment.
