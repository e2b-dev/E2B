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
- Using packer for creating rootfs images instead of docker?
- https://cloud.google.com/compute/docs/disks/local-ssd#choose_an_interface
- https://cloud.google.com/compute/docs/disks/mount-ram-disks
- https://www.google.com/search?q=btrfs+zfs+ext4&sxsrf=APq-WBubG7Uq1tq97zwnRekapuQAytx05g%3A1651126058214&ei=Ki9qYs_kDL7-7_UPk5Sm2As&oq=btrfs+and+zfs+and+ex&gs_lcp=Cgdnd3Mtd2l6EAMYADIGCAAQFhAeOgcIABBHELADOgUIIRCgAToICCEQFhAdEB5KBAhBGABKBAhGGABQwARY4wtguhNoAXABeACAAXiIAdUEkgEDNi4xmAEAoAEByAEIwAEB&sclient=gws-wiz
- Using NIX to manage
