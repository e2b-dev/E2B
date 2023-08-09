# DEV
## Infra
- Clock drift
  - https://github.com/firecracker-microvm/firecracker/blob/eb8de3ba1f7cb636d2aaa632fe96b234f3a302e6/FAQ.md#my-guest-wall-clock-is-drifting-how-can-i-fix-it
  - check with CSB how they solved this
  - it should happen in the first log2(3) seconds
- Change read/write file to allow other thatn utf-8 format so we don't break the files
- Remove dnsmasq from cluster VM image if it is not needed
- Remove need for provisioning during building env
- Create the FC rootfs without using Docker just by unpacking the tarballs
- Improve generating of FC API client in the firecracker task driver
- Can we skip starting the FC during the build process?
  - Maybe running the FC is necessary because we really want to have the memory snapshot of the core FC env to be able to use it for the new envs immediately.
- Disable public read access to the bucket with kernel
- Separate cluster server and client images
- Stop timestamping cluster disk images
- Use rootfs diffs
- Use FC memory diffs
- Use task drivers instead of shell scripts for managing envs
- Can we use ignite for FC handling or at least building of envs?
- Make separate package from fc snapshot managing in task driver?
- Stop handling part of the instance's sessions networking via `/etc/hosts` - this is potential slowdown and lock
- Check if the kernel args we are using are what we want
- Improve API (efficient calls Nomad calls, no polling, etc.)
- Improve FC WS connection (subscriptions take additional calls, maybe we can improve that, etc.)
- Move to ubuntu
- Update kernel version
- Move to a better FS handling (filestore, fuse?)
- Fix possible mutex problems in the firecracker task driver
- Update devbookd in all envs automatically
- remove .dbk env vars and code snippet functionality from the devbookd
- fix empty error logs from devbookd that we can see in the betterstack logs
- sync OpenAPI schema version with the release version
- Move API keys to header from query params
- Fix API rotues so they make sense (no code snippet, just envs)
- Add automatic refreshing of edit sessions that are currently being snapshotted, so they don't expire
- Wait for the end of `POST /envs` and `PATCH /envs/{codeSnippetID}` operations - the mechanism is already implemented
- Add access control to the remaining envs routes and for the edit session request
- Add monitoring to the envs routes
- Make the API server stateless by moving the session state to the DB
- Fix the DB schema - right now it reflects the use case with code snippets we started with
- Improve release pipeline so the SDK/CLI is not released every time (triggered by version increase)
- Use CNI to handle networking - https://github.com/containernetworking/cni
- Limit build/update env CPU and memory or build the envs in a separate machine
- Limit session length - is a session runnign 48 hours really something we want to allow? These sessions also accumulate over time
- Add snapshotting on demand
  - We should maybe delete unused snapshots after some time to save space
- Add memory balooning
- Check problem with releasing memory when using Firecracker
- Delete files after a failed build/update env
  - Stop possible running containers and delete docker image
- fc-envs build scripts are sometimes cached
- Use the FC jailer properly
- Rebuild only the changed templates on push
- Update NodeJS version
- Remove top package-lock
- Remove gitpod deps and mentions (makefile, gitpod yaml)
- Remove devbook specific code from the repo (allow move to new org or on prem deploy)
- Improve caching of the GH actions
- Add instance sizes and other things as variables in the GH actions and remove them from codes
- API URL should be configurable
- add testing/staging env
- create proper monorepo for the packages (pnpm for Node) and improve release system
- Add memory swap to Rust - OoM when compiling bigger programs
  - https://www.digitalocean.com/community/tutorials/how-to-add-swap-space-on-ubuntu-22-04
- Should we use ubuntu 22 for envs?
- Does ubuntu need the newer kernel?
  - Using driver with multiple kernels
- Cloud Hypervisor insted of FC - https://github.com/cloud-hypervisor/cloud-hypervisor
- Add installation instructions for all tools used in the repo
- API for creating snapshots
- eBPF
- using devbookd locally for development of agent without remote
- Send usage metadata from the SDK to the session server (observability)
- **How to handle users/api keys when we have multiple projects?**
- Store old snapshots when publishing so you can rollback (both prod and edit version)
- Add more detailed observability/analytics
- envs vars in SDK/devbookd are not working correctly
- in JS SDK spawn api client for each instance
- in JS SDK improve the types/usage API
- Can process/terminal stdin accept non utf-8 data? We may want to handle this in the SDKs and devobookd
- process stdout reading on char or on line? (on line could block and return only each second)
- the terminal and process id should be automatically assigned in devbookd
- Agents passing envs around between each other
- Auth for access to env by agents
- Security checks/deps - paid GH?
- Add supabase config to this repo so the backend is codified
- Generated types in go?
- Clarify naming in the sdk -- fs, filesystem, session, environment, instance?
- "Pluging" to the SDK - linters, git, the agent protocol
- Better SDK errors and exceptions
- Allow running commands as user (homedir + sudo) instead of root
- Use CNI for FC networking
- FC alternatives
- Change casing of the reported ports from the devbookd
- Use binary data streaming over websocket instead of using the jsonrpc in devbookd
- Decide if we want to have the REST API alongside the SDKs
- Exceptions are part of the SDK API!
- remove undefined from JS SDK services
- What was the FC alternative that supported Windows?
- Start tty in devbookd only after hooking it to the onData subscribers!
- vale for text linting
- embed all hcl tasks in the API code
- Do we need provisioning script now? Without it it could be easier to build custom envs. Also think about how flyio solved the daemon - I think they just injected the daemon into the environment. Codesandbox also has a daemon in the env but they don't have a update pipeline for the old envs because it is not needed.

### Python SDK
- devbookd scan lines problem (vs scan bytes)
- fix template/id type
- improve docstrings
- use yield/generators instead of callback handlers
- should callback handlers be async?
- add release action setup
- use attrs or dataclasses?
- Check double slash `//dir` in file watcher event data
- better readme
- start filesystem watcher automatically
- improve DX - clearly communicate instantiation+initialization flow, awaiting object for exit, etc
- sync flow?
- add tests
- support lower python versions
- Check if stderr and stdout are ordered
- Myabe remove types (and timestamps?) from stdout/stderr
- Use specific version (nodejs20) for the templates
- Using pathlib for paths? windows support?
- Flush all stdout/err after killing process or terminal in devbookd and also wait for the Stdout/err in the SDK
- handle when user passes async handler for on_stdout, exit, etc.


## CLI
- fix error whe disconnecting from `connect`
- `template is a required field` error when trying to `use [envID]`
- Add a warning about scanning local fs when the ls command takes too long
- CLI program name should be obvious from the NPM package name
- Fix CI/CD deployment (pnpm, SDK)
- Integrate with environmentID in `guide.json`
- Add published/unpublished label to `env list` output
- Add disclaimer when the env is unpublished to `env push`
- Change `/` root to `/code` root in 
  - Handle deleting files that were removed in local filesystem - how can we recognize that the file was deleted? Saving what was pushed last and only manipulating with these files? (lock) If the file changed since then we should probably ignore it (save name+hash that we already calculate for everyting together)
- Allow custom string for template (--select option for the current list?)
- Fix size and dependencies - packaging could work better
- Change template option description
- Finish CLI README
- Warn about having multiple configs for the same environment
- Put template field from dbk.toml in a separate [] category so it is not confused with id because they can look the same
- Add default "empty" template that is used if you don't define anything
- Ignore "files" directory when pushing if it is not present
- Connect with id may be creating toml?
- Enable auth flow/creating tokens from CLI?

### FC mutation limit
> With a microVM configured with a minimal Linux kernel, single-core CPU, and 128 MiB of RAM, Firecracker supports a steady mutation rate of 5 microVMs per host core per second (e.g., one can create 180 microVMs per second on a host with 36 physical cores).

### CLI Feedback
> How can I create the DEVBOOK_KEY? It seems I can’t create resources without it

> I haven’t used the dashboard before and I presumed I might have needed an invite to a team or sth of the sort.

> Can I change my email? (dashboard)

> Should I store the .dbk files in the repo?

> I just realized the only way I can edit a file in an environment is using vim. I’m not familiar with vim, and editing files might be tedious. Is there a way I can connect to an environment using VS Code Remote - SSH extension?

> Should the ./files directory mimic the file system on the environment? i.e. have a code/prisma/migrations directory and other files?
- It should contain just the files you want to be there. Right now the command finds all the files and uploads them — if overwrites the old files but if there were some files or directories already it will not delete them — for now you can do that via the “connect” and rm command in the env.

> I’ve only connected to the environment to create the initial migration and install dependencies. I might also set up a seed script/ file to seed the database with data. (that might be an extra step)

> Can I update an environment once I’ve published it?

> Would updating one environment and publishing it cascade to the other environments that depend on it?

## Uptime/reliability
- We can potentially solve this by using firecracker snapshots to migrate active sessions more seamlessly.

## Envs system
- "ad-hoc" no provision if hashes match
- git based workflow
- unlimited forking
- minimal overhead with diff snapshots

The system would work similarly to git - you have env config inside a repository and every time you push a new environment will be forked from the old environment - its whole id will be <envID>-<changeToEnvHash> where change to env has represents the changes made by push. The has will be also saved to the config identifying environment so we know what environment to fork next time we push.

We would need to keep all environments forks because wa want to be able to access it like in a git -- when you checkout old commit you can get the old environment. This will also help with the diff snapshots - if you start the environment the actual snpashot would be made by composing all the snapshots of the fork's "parents", reducing space needed.

We need to use rootfs CoW **and** diff snapshots for this, because otherwise each change and push would need at least [amount of FC RAM] data of extra space.

This will allow you to create "common base" environments just by copying environent that you want to base the new env on and doing push.

Even setup from terminal/installed packages can be cached this way if we just modify the env cache either by diggesting all the input you entered into terminal or naively by just diggesting some randomized value everytime you connect to the edit session (maybe there are no edit sessions now?) by terminal, creating a new hash. Maybe the fork will happen everytime jsut before you connect to edit session so we can keep the environments immutable.

There will be no "templates", just other envs you want to base the current env on and you don't have to explicitly say "base this new env on existing env with <envID>", you just start using the old env and make changes to it and a new environment with the changes will be automatically created.

The template field that each environment will be used for composing the diff snapshots and can be also used for constructing the "tree of snapshots".

- How to turn this into "stateful serverless"?
