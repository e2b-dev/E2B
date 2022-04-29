# Plan

## 1. Foundation - deployment, orchestration, mesh
- Fix startup script (Nomad crash)
- Check rolling updates -> nomad state
- Configure Consul and Envoy
- Add health checks for Nomad
- Allow connecting to the running Nomad from Terraform

## 2. Core Services - FC, API, specific networking, lifecycle management
### FC
- Install FC plugin to Nomad
- Modify FC plugin to work with FC 1.0
- Modify FC plugin to work with snapshots
- Add CNI plugins
- Add network config for FC
- Disable hyperthreading when starting FC
- Revisit system for retrieving session ID and FC addresses - with the original task driver they are written to a file but we can modify that and send this info in the job response in API
- Copy on write/in memory handling
- Expose sessions to the outside world
- tinit + communication with SDK - is WS best solution? RPC protocol definitons? What are the most primitive building block from which we can build the whole interaction?
- FC tinit health endpoint
- Expose FCs to the outside world - each should have an address

### API
- Expose API to the internet
- Specify rootfs/snapshot when starting session
- Add request for measuring how many sessions are running
- Add scheduling/pinging system that kills inactive sessions.
- Add parametrization to the session requests (which env to spin, etc.) -> check openAPI request body generation

## 3. Automation - envs, monitoring, authentication
- Make a different image for clients and for servers
- Add monitoring and logging (consul, envoy, prometheus, grafana)
### Envs
- Add API endpoint for managing envs
- React to storage Dockefile upload OR image upload (maybe this is more user friendly because they can debug on their machines with our CLI)
- Run the provision script in container
- Create rootfs from the container
- Build and save kernel (we might be using 4.16 instead of 5+ because of snapshot start times)
- Start firecracker with the rootfs and make the snapshot
- Upload the snapshot to Filestore or persisten disk
- Mount FC persisten disk or Filestore on start (explore Nomad external volumes)

### Authentication
- Rate limiting
- Authentication for sessions
- Authentication for API
