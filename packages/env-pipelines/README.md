# FC env

## Use new devbookd
Change the `version="v*.*.*"` in the [publish.sh](publish.sh#L14) to the version of devbookd you want to use in new envs.

## Resizing fc-envs disk (XFS)
After modifying https://console.cloud.google.com/compute/disksDetail/zones/us-central1-a/disks/fc-envs?project=devbookhq disk size in the dashboard you need to resize the partition by running the `xfs_growfs -d /dev/sdb`.
