# E2B API

Monorepo with backend services for handling VM sessions, environment pipelines, and the API for them.

## Deployment

Run `make version` and commit the changes the command generates.
Then push to `main` to deploy these changes. Changed packages will be automatically deployed.

**If the deployment fails don't run the previous commands again, just fix the error and push to `main`.**

### Errors in the env-instance-task-driver
If you are not developing env-instance-task-driver module on a unix machine you won't be able to complile the module because you will miss constants like "netlink.SCOPE_UNIVERSE".
Use the ubuntu devcontainer to develop this module.

### Resizing fc-envs disk (XFS)
After modifying https://console.cloud.google.com/compute/disksDetail/zones/us-central1-a/disks/fc-envs disk size in the dashboard you need to resize the partition by running the `xfs_growfs -d /dev/sdb`.

### Creating XFS filesystem
```
mkfs.xfs  /dev/sdb
```

> You need to remount the fs after formatting it.

### Convert disk to XFS
- https://access.redhat.com/discussions/6134431


### FC API Client
For generating the FC client use go swagger (https://goswagger.io/install.html).
Right now you need to manually check and update the [firecracker yml](./internal/client/firecracker.yml) version. It should match the version of the firecracker binary you are using specified in the [terraform file](../cluster-disk-image/variables.pkr.hcl).
