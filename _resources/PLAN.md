# Plan

## 2. Core Services - FC, API, networking, lifecycle management
### FC
- Modify FC plugin to work with snapshots
- Copy on write/in memory handling
- Revisit system for retrieving session ID and FC addresses - with the original task driver they are written to a file but we can modify that and send this info in the job response in API
- tinit + communication with SDK
- Expose FCs to the outside world - each should have an address

## 3. Automation - envs, monitoring, authentication, SDK
- Create SDK
- Add scheduling/pinging system that kills inactive sessions.
- Add auth
- Add parametrization to the session requests (which env to spin, etc.) -> check openAPI request body generation

### Envs
- Build and save kernel (we might be using 4.16 instead of 5+ because of snapshot start times)
- React to storage Dockefile upload/image upload (maybe this is more user friendly because they can debug on their machines with our CLI)
- Run the provision script in a container
- Create rootfs from the container
- Start firecracker with the rootfs and make the snapshot
- Upload the snapshot to Filestore or to a persistent disk
- Mount FC persistent disk or Filestore on start (explore Nomad external volumes)
