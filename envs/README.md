# Orchestration Environments

## TODO

### Sprint 2

react to storage Dockefile upload OR image upload (maybe this is more user friendly because they can debug on their machines with our CLI?)

run the provision script in container

create rootfs from the container

start firecracker with the rootfs and make the snapshot

upload the snapshot (artifact registry vs Storage?)

build and save kernel

download rootfs+snapshots to a peristent volume connected to all clients

Add monotoring and logging (consul, envoy, prometheus?)

## Resources
- https://github.com/combust-labs/firebuild#high-level-example
- https://cloud.google.com/compute/docs/disks/performance
- https://cloud.google.com/filestore/docs/mounting-fileshares (pretty expensive)
- https://cloud.google.com/sdk/gcloud/reference/compute/instances/attach-disk (more work)
- https://cloud.google.com/compute/docs/disks/regional-persistent-disk#use_multi_instances
- https://gist.github.com/caleblloyd/4651e713689bfe43c74d
