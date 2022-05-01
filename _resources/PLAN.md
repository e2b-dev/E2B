# Plan

## 1. Foundation - deployment, orchestration, mesh
- Nomad instances are not connected
- Check rolling updates -> nomad job state
- Add health checks for Nomad (maybe we won't need them with consul+envoy)
- Allow connecting to the running Nomad from Terraform (do we need proxy here?)
- Fix dnsmasq install, check mesh

## 2. Core Services - FC, API, networking, lifecycle management
### FC
- Add FC plugin to Nomad
- Add CNI plugins
- Add network config for FC
- Modify FC plugin to work with FC 1.0.0
- Modify FC plugin to work with snapshots
- Copy on write/in memory handling
- Disable hyperthreading when starting FC
- Revisit system for retrieving session ID and FC addresses - with the original task driver they are written to a file but we can modify that and send this info in the job response in API
- Expose FCs to the outside world - each should have an address
- tinit + communication with SDK - is WS best solution? RPC protocol definitons? What are the most primitive building block from which we can build the whole interaction?
- FC tinit health endpoint

### API
- Expose API to the internet
- Add parametrization to the session requests (which env to spin, etc.) -> check openAPI request body generation
- Add request for checking how many sessions are running
- Add scheduling/pinging system that kills inactive sessions.

## 3. Automation - envs, monitoring, authentication, SDK
### Envs
- React to storage Dockefile upload/image upload (maybe this is more user friendly because they can debug on their machines with our CLI)
- Run the provision script in a container
- Create rootfs from the container
- Start firecracker with the rootfs and make the snapshot
- Upload the snapshot to Filestore or to a persistent disk
- Mount FC persistent disk or Filestore on start (explore Nomad external volumes)
- Add API endpoint for managing envs
- Build and save kernel (we might be using 4.16 instead of 5+ because of snapshot start times)

### Authentication
- Authentication for API
- Authentication for sessions

### SDK
- Create a pure JS connector

### Monitoring 
- Add monitoring and logging (consul, envoy, prometheus, grafana)