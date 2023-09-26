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
- Remove supervisord and just use systemd for both nomad and consul
- Enable terraform cache again later (cca 16 blocking seconds saved per GHA run)
- Secure docker building (+container start problem?)
- Install golang to the vm for easier remote debugging
- add otel logs
- add more otel events
- improve no attributes trace (if branch for zero)
- fix vscode setup errors
- make buckets not public
- check api build speed
- Update architecture diagram in figma
- Make all the shellscript more resilent (best practices)
- Configure hyperthreading for better FC performance? https://cloud.google.com/compute/docs/instances/set-threads-per-core?authuser=1
- Check the FC rootfs build https://github.com/firecracker-microvm/firecracker/blob/main/docs/rootfs-and-kernel-setup.md#creating-a-rootfs-image - make sure the special filesystems are mounted!
- Change min CPU platform of the client instance to be only 1 possible CPU type (now it is 2)
- Check with race condition build
- Nomad server sizes + number + disk io
- Use hashes
- Fix bytes/bytearray types in python SDK
- Check quota limits for all our needs!! (N2 are separate)
- add jailer as soon as possible (before snapshots)
- how to solve snapshot storage problem?
- Add local apt-get mirror for provisioning
- Update nomad
- Ensure required programs and files are ready during each driver init
- Improve CLI errors returned from API
- CLI upload the context while archiving in stream
- Setup the linter (exhaustruct is useful)
- Move provisioning script to api for DX (escaping problems)
- Using docker "commit container" to store provisioned containers
- Catch and parse errors from the docker build to inform us and users about the state of the build - right now the docker build fails silently and the error is on the next step where container start cannot find image with the specific name
- Check how people use otel in other go projects

### API
- Add monitoring to the envs routes
- Make the API server stateless by moving the session state to the DB
- Add better error if the env was not found
- Improve request logging
- Check if stream is not causing Nomad timeouts in the API?
- Check keep in sync sessions
- Check if the wait for job always works
- improve escaping in the API jobs so it is not possible to break the API
- Fix api panic via team.ID undefined access

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
- The read/write bytes should be by chunk (we can implement it via ws or a new endpoint?)
- mount envd on separate volume?
- Switchable user via parameter
- Implement primitives for all core services (https://nodejs.org/docs/latest-v20.x/api/fs.html) so we don't have to update the envd for every new feature
- Make process handler in envd more primitive (less configuration of things like shells/interactive, etc -> move this to SDK? would need to implement in both SDKs correctly)
- The maximal size of scanned line in current envd is 64k - increase this or change the system of scanning to use bytes instead of lines (while still having buffer)
- Hook output handlers to the terminal tty before starting the process via pty
- Check the https://pkg.go.dev/golang.org/x/term library for implementing the terminal functionality

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
- Run the env build parts in parallel (network + rootfs)
- Improve envd copying (now we need to convert to tar before copying)
- Do the provisioning in a separate tar and extract after the rest of the build finishes?
- Add logs from vm process start + FC logs
- Add channel for better build still running Fc signalization
- Make init signalize when it is ready

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
- Add critical error report to the origin span in FC driver
- move FC start logic to separate dir for testing
