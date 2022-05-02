# Plan

## 2. Core Services - FC, API, networking, lifecycle management
### API
- Add parametrization to the session requests (which env to spin, etc.) -> check openAPI request body generation

### FC
- Add CNI plugins
- Add network config for FC
- Modify FC plugin to work with FC 1.0.0
- Modify FC plugin to work with snapshots
- Copy on write/in memory handling
- Disable hyperthreading when starting FC
- Revisit system for retrieving session ID and FC addresses - with the original task driver they are written to a file but we can modify that and send this info in the job response in API
- Expose FCs to the outside world - each should have an address
- tinit + communication with SDK - is WS best solution? RPC protocol definitons? What are the most primitive building block from which we can build the whole interaction?

## 3. Automation - envs, monitoring, authentication, SDK
- Create SDK
- Add scheduling/pinging system that kills inactive sessions.
- Add auth

### Envs
- React to storage Dockefile upload/image upload (maybe this is more user friendly because they can debug on their machines with our CLI)
- Run the provision script in a container
- Create rootfs from the container
- Start firecracker with the rootfs and make the snapshot
- Upload the snapshot to Filestore or to a persistent disk
- Mount FC persistent disk or Filestore on start (explore Nomad external volumes)
- Build and save kernel (we might be using 4.16 instead of 5+ because of snapshot start times)
