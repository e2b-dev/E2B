# Orchestration Services

Backend services for handling VM sessions, environments' pipeline, and the API for them.


## Development
### GCE Terraform troubleshooting
If you get stuck with a non-working Nomad on all VMs and therefore you are not able to change the infrastructure because the Nomad jobs that are supposedly running there cannot be reached use the:
```
sudo nomad agent -dev -bind 0.0.0.0 -log-level INFO
```

to start temporary Nomad on any server and tear it all down with `terraform apply -destroy`.

If the Nomad is running but it has no leader, delete Load balancer and Instance group then destroy the infrastructure.

### Subtrees
FC task driver is a submodule made from https://github.com/devbookhq/firecracker-task-driver repository.

The subtree commands you need for controling this repo are:
```bash
git subtree add --prefix modules/orchestrator/firecracker-task-driver https://github.com/devbookhq/firecracker-task-driver.git master
```

```bash
git subtree pull --prefix modules/orchestrator/firecracker-task-driver https://github.com/devbookhq/firecracker-task-driver.git master
```

```bash
git subtree push --prefix modules/orchestrator/firecracker-task-driver https://github.com/devbookhq/firecracker-task-driver.git master
```

## Deployment

Orchestration API is currently deployed via Cloud Build and Cloud Run.
