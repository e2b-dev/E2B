# Devbook CLI

## Quick overview
- You can create something called “environment” on our  backend — this is an “image” of a VM that is then used to create separate instances when users come to Prisma Hub
- You create these environments via the CLI — with env create command and it also creates a dbk.toml that references this environemnts. That is used to defined setup like “I want this local directory to be uploaded” and to keep track about the environments via git.
- You can base environment on existing environments by using env create --template <baseEnvID> command flag — this way you don’t have to setup language servers, postgres, etc everytime you create new guide. You can use the environmentID that is used in the the current guides as the template now — env create --template s8GzxcGmvrpf
- You need to publish the env (env publish , while in the dir with the config) to make the changes publicly visible
- If you want to add new files create a directory alongside the config that has the same name as the directory mentioned in the config local_root = "./files" (here it is files ) and this directory will be uploded with the env push command. The terminal in the guides start in the /code directory so you need to put your actual files in the local filesystem to the files/code  directory.
- Deleting files from the env right now is a little more complicated — you need to use (env connect , while in the dir with the config) to “ssh” into the environment and there you can use the terminal to delete the file. After disconnecting you also need to publish the changes!
- I think the ideal setup for the envs in the prisma hub is that you have a “defaultGuideEnvironment” directory in the content dir with a config inside (created via env create) and a config in each guide directory that needs environment that is different from this base.
- You need to take the environment  id (copy it from the config for example) and use in in the guide.json (as environmentID ) if you want that guide to use the environment for that guide.

## Installation

```sh
npm install -g @devbookhq/cli
```

## Usage

```sh
devbook env <command>
```

> You can also use `dbk` as a command shorthand for the Devbook CLI.

### What is a template?

> You can use any other environment as a template.

### What is an environment?
> How does an environment relate to guides?

### What is published environment?
How does environment and published environment relate to each other?

### What is `dbk.toml` config?

### What to do after deleting `dbk.toml`?

### Can I have multiple `dbk.toml` configs for the same environment?

#### How can I change title

### Create a new environment

### Use existing environment

### Save files from repository to environment

### Install dependencies inside environment

### Make environment publicly available

### Delete environment

### Inspect files inside of the environment

### Delete files from environment

### List all environments

### Find environment configs inside repository

### Inspect how the publicly available environment looks like right now

### Publish all environments with configs in a repository

### Push all environments with configs in a respository

### Change environment title

## Commands

### Create
### Push
### Publish
### Delete
### Use
### Connect
### List

## Config

### `id`
### `template`
### `title`
### `filesystem.local_root`
