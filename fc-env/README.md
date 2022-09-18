# FC env

## Resizing fc-envs disk (XFS)
After modifying https://console.cloud.google.com/compute/disksDetail/zones/us-central1-a/disks/orch-fc-envs?project=devbookhq disk size in the dashboard you need to resize the partition by running the `xfs_growfs -d /dev/sdb`.
