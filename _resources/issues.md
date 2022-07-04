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
- Rootfs size
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

### Can we use NIX to solve our deps in envs?

### Delete files after a failed build/update env
- Stop possible running containers and delete docker image

### Rebuild only the changed templates of push
