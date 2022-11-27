# Issues
### Clock drift
- https://github.com/firecracker-microvm/firecracker/blob/eb8de3ba1f7cb636d2aaa632fe96b234f3a302e6/FAQ.md#my-guest-wall-clock-is-drifting-how-can-i-fix-it

### Automation
- Separate cluster server and client images
- Stop timestamping cluster disk images

### Disk space
- Increase available space for envs
- Diff snapshots

### Session speedup
- `/etc/hosts` lock slowdown
- Kernel args
- API (Nomad calls, polling, etc.)
- Connecting WS (subscriptions take additional call, etc.)
- Diff snapshots

### devbookd update
- Update devbookd in all envs

### API keys, routes
- Move API keys to header
- Fix API rotues so they make sense

### Limit build/update env CPU and memory

### Add balooning

### Can we use NIX to solve our deps in envs?

### Delete files after a failed build/update env
- Stop possible running containers and delete docker image

### Rebuild only the changed templates on push
