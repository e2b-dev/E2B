# DEV

## Reading

- https://blog.cloudkernels.net/posts/kata-fc-k3s-k8s/
- https://ongres.com/blog/automation-to-run-vms-based-on-vanilla-cloud-images-on-firecracker/
- https://news.ycombinator.com/item?id=36666782
- https://github.com/weaveworks-liquidmetal/flintlock
- https://github.com/magmastonealex/firedocker
- https://github.com/weaveworks/ignite
- https://github.com/superfly/init-snapshot
- https://franck.verrot.fr/blog/2019/03/16/request-routing-with-nomad-and-consul
- https://github.com/modal-labs/modal-client/blob/main/modal/sandbox.py

## [Architecture](https://www.figma.com/file/pr02o1okRpScOmNpAmgvCL/Architecture)

## Issues

### General

- Separate cluster server and client images
- Stop timestamping cluster disk images
- Remove devbook specific code from the repo (allow move to new org or on prem deploy)
- Add instance sizes and other things as variables in the GH actions and remove them from code
- Add supabase config to this repo so the backend is codified? (gorm?)
- Try to remove need for the websocket backoff/reconnect
- use .env for better DX (enve for terraform and all modules)
- improve reliability, monitoring,
  - Add more detailed observability/analytics to all parts of the system
  - Logs from every environment, the whole lifecycle of the session needs to be searchable with just an ID of the session
  - Being able to see all the sessions and logs for each session for the given team
  - Long running events notification
  - Status pages for different parts of our infra
  - Add sentry for better monitoring
  - Explore lightstep alternatives
- VM instances should not have external IPs
- Golang monorepo + terraform setup practices
- How to decouple terraform and domains
- Enable advanced security scanning via GH
- Better release system
- create shared golang libs
- rename everything from sessions and fc-...
- share tracing modules between task drivers
- parametrize buckets and mount paths
- enable simpler debugging

### API
- Add monitoring to the envs routes
- Make the API server stateless by moving the session state to the DB
- Add better error if the env was not found
- Improve request logging

### Envd
- envd jsonrpc parameters could be objects instead of arrays (compatibility advantages)
- Check FC env envd freeze bug (probably OOM)
- Update envd in all envs automatically
- remove code snippet service from the envd
- fix empty error logs from envd that we can see in the betterstack logs
- envs vars in SDK/envd are not working correctly (terminal, process)
- Start tty in envd only after hooking it to the onData subscribers!
- Explore GRPC for communication between envd and SDK
- envd scan lines problem (vs scan bytes)
- Change casing of the reported ports fields from the envd
- Use binary data streaming over websocket instead of using the jsonrpc in envd - maybe use REST API for this
- How to monitor envd OOM and similar errors remotely?
- Envd api versioning to SDK
- Flush all stdout/err after killing process or terminal in envd and also wait for the Stdout/err in the SDK
- Change read/write file to allow other than utf-8 format so we don't break the files
- Permissions and default directory for filesystem operations
- Improve FC WS connection (subscriptions take additional calls, maybe we can improve that, etc.)
- pam_env(sudo:session): Unable to open env file: /etc/default/locale: No such file or directory -- fix locale
- Fix correct user permission for home dir (chown setup problem before FC startup)
- relative paths are not handled correctly for the session.filesystem
- on_ports should be better - not periodically reporting, but more on change? or on request
- Remove types (and timestamps?) from stdout/stderr (they are already fully identified by the subscription)
- "~" is not working in the filesystem service
- Using vsock for managing logs
- Check close "allUnsubscribed" in envd sub manager

### Build system
- Use overlays instead of cp reflink so we can use any FS type
- Remove need for provisioning during building env?
- Create the FC rootfs without using Docker just by unpacking the tarballs
- Can we skip starting the FC during the build process?
  - Maybe running the FC is necessary because we really want to have the memory snapshot of the core FC env to be able to use it for the new envs immediately.
- Disable public read access to the bucket with kernel
- Use rootfs diffs
- Use FC memory diffs
- Can we use ignite for FC handling or at least building of envs?
- Check if the kernel args we are using are what we want
- Update kernel version
- Move to a better FS handling (filestore, fuse?)
- Limit build/update env CPU and memory or build the envs in a separate machine
- Delete files after a failed build/update env
  - Stop possible running containers and delete docker image
- make the instance image minimal -- put the kernel, fc, etc to the nomad artifacts
- Check debian vs ubuntu
- Use specific versions (nodejs20) in the templates' names
- https://github.com/superfly/flyctl/blob/2cd869f333b12b6a1360fdbe4c2208d81b666894/internal/build/imgsrc/dockerfile_builder.go#L184
- Starting user's dockers on our infra during build could be INSECURE (https://blog.gitguardian.com/how-to-improve-your-docker-containers-security-cheat-sheet/)
- We need to remove the entrypoint and cmd from docker
- start the fc vm more efficiently (not separate requests to the API, wait before last, etc.)

### FC
- Improve generating of FC API client in the firecracker task driver
- Stop handling part of the instance's sessions networking via `/etc/hosts` - this is potential slowdown and lock
  - Use dnsmasq instead of /etc/hosts and second proxy
  - Remove dnsmasq from cluster VM image if it is not needed
  - Can se skip all proxies and just use consul for routing all traffic to the right clients and fc instances?
- Fix possible mutex problems in the firecracker task driver
- Fix ip address space distribution via fc task driver
- Use CNI to handle networking - https://github.com/containernetworking/cni
- Add memory balooning
- Check problem with releasing memory when using Firecracker
- Use the FC jailer properly
- Add memory swapping to compensate for RAM limitations
- Explore Cloud Hypervisor and QEMU alternatives
- rpc error: code = Unknown desc = failed to get IP slot: failed to write to Consul KV: Unexpected response code: 429 (Your IP is issuing too many concurrent connections, please rate limit your calls)
- Fix "namespace cannot be transferred" error
- Use haproxy or envoy proxy?
- Use balloning device to reclaim memory before making the snapshot to reduce the size of the snapshot
- Use library for FS mounting in firecracker task driver
- Reattach to fc process on recover in task driver
- Should FC driver download/setup both FC and kernel?
- Resuming snapshot on different CPU type is insecure
- If you are running on bare metal you need to manage CPU vulnerabilities
- Lambda is solving logging by custom rust software that is connected to the tap device
- Snapshotting and updating is hard because you need to keep up to date and have backup copies
- Lambda is using multilayered cache for storage of the snapshots/source
- Resuming more than one snapshots can be insecure because the random seed is not changed
- use FC go sdk instead of the generated client?
