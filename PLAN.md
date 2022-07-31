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