# Issues
### Clock drift
- https://github.com/firecracker-microvm/firecracker/blob/eb8de3ba1f7cb636d2aaa632fe96b234f3a302e6/FAQ.md#my-guest-wall-clock-is-drifting-how-can-i-fix-it

### Security
- Restrict firewalls
- Add ACL to the Nomad/Consul
- Remove public IPs from the cluster instances

### Automation
- Separate cluster server and client images
- Stop timestamping cluster disk images

### Disk space
- Increase available space for envs
- Diff snapshots

### Session speedup
- `/etc/hosts` lock slowdown
- Kernel args
- **Rootfs size is affecting the startup time** - Rust template is unusable
- API (Nomad calls, polling, etc.)
- Connecting WS (subscriptions take additional call, etc.)
- Diff snapshots

### FC errors
```
rpc error: code = Unknown desc = task with ID "6d791002-62d8-dd6a-5ba5-e5aa5c415d61/start/1367a2c6" failed: "failed to start preboot FC: Firecracker did not create API socket /tmp/.firecracker.sock-1985-926: 1 error occurred:\n\t* exit status 1\n\n"
```

```
rpc error: code = Unknown desc = task with ID "fbb4585a-e2b8-2038-12b2-281c9bd29d14/start/401fe14b" failed: "failed to load snapshot: [PUT /snapshot/load][400] loadSnapshotBadRequest &{FaultMessage:The requested operation is not supported after starting the microVM.}"
```

```
rpc error: code = Unknown desc = task with ID "c1df116d-e3ab-593c-77b0-16ea17e02bdc/start/c3b29e1d" failed: "failed getting pid for machine: machine process has exited"
```

```
failed to setup alloc: pre-run hook "alloc_dir" failed: Failed to make the alloc directory /opt/nomad/data/alloc/86ebb35a-bcdd-e1b1-7b1e-09349deb894d: mkdir /opt/nomad/data/alloc/86ebb35a-bcdd-e1b1-7b1e-09349deb894d: no space left on device
```

- fc-task-driver crashed (panic?) and it couldn't cleanup the old sesions

### devbookd update
- Update devbookd in all envs

### Monitoring, logs
- Graphana, Prometheus

### API keys, routes
- Move API keys to header
- Fix API rotues so they make sense

### Uncache CF workers
- When updating published CS the workers are returning cached data

### Open Graph
- Add dynamic open graph images for the sharable CS links

### Change GH auth to email auth

### Use hardlinks for edit snapshots

### Limit build/update env CPU and memory

### Add balooning

### Check if the session is really limited

### Can we use NIX to solve our deps in envs?

### Delete files after a failed build/update env
- Stop possible running containers and delete docker image

### Rebuild only the changed templates on push

### Alpine Linux init example
- https://gist.github.com/thde/5312a42665c5c901aef4

### Check if the embed is not cached by Cloudflare

### Fix output UI layout (splited view with the actual code editor)

### Add styling to the embed

### Can we use BTRFS?

### Dirty edit env indicator

### Intellisense for the code editor with snippets

### CLI or GitHub app for automation

### Continuous writing to code snippet file (not only on run)

### CS run button layout, building info layout

### Add Slack notif on signup

### Shortcuts for run

### Code and terminal init height should depend of the window size

### Add Devbook logo to the dashboard

### Add terminal feature to the published code snippet and to the embed

### You now cannot delete last char in the code snippet name