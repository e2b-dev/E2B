# E2B API

Monorepo with backend services for handling VM sessions, environment pipelines, and the API for them.

## Deployment

Run `make version` and commit the changes the command generates.
Then push to `main` to deploy these changes. Changed packages will be automatically deployed.

**If the deployment fails don't run the previous commands again, just fix the error and push to `main`.**

### Errors in the firecracker-task-driver
If you are not developing firecracker-task-driver module on a unix machine you won't be able to complile the module because you will miss constants like "netlink.SCOPE_UNIVERSE".
Use the ubuntu devcontainer to develop this module.
