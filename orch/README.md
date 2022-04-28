# Orchestrator

## TODO

### Sprint 1

Install firecracker plugin

Add CNI plugins

Add network config

Deploy correct image with Terraform - versioning? (https://www.packer.io/docs/datasources/hcp/hcp-packer-image)

### Sprint 2

Check if Go and HCL templates interfere

Disable hyperthreading

Revisit system for retrieving session ID and FC addresses - with the original task driver they are written to a file but we can modify that and send this info in the job response

Use FC snapshots in the driver

copy on write/in memory handling - we don't want to store the snapshots after sessions end

outside world session exposure

tinit + communication with SDK - is WS best solution? RPC protocol definitons? What are the most primitive building block from which we can build the whole interaction?

authentication of session access

Delete old disk images

Add monotoring and logging (consul, envoy, prometheus?)

Make specific image for clients and for servers

Evaluate
- https://github.com/codebench-dev/worker
- https://www.koyeb.com/blog/the-koyeb-serverless-engine-from-kubernetes-to-nomad-firecracker-and-kuma
- https://stanislas.blog/2021/08/firecracker/
- https://webapp.io/blog/github-actions-10x-faster-with-firecracker/
- https://timperrett.com/2017/05/13/nomad-with-envoy-and-consul/

## Resources
- https://github.com/containernetworking/cni/blob/spec-v0.3.1/SPEC.md
- https://jvns.ca/blog/2021/01/20/day-42--writing-a-go-program-to-manage-firecracker-vms/
- https://github.com/weaveworks/ignite/blob/main/pkg/dmlegacy/snapshot.go#L61-L118
- https://github.com/cneira/firecracker-task-driver/issues/20
- https://github.com/firecracker-microvm/firecracker/issues/2027
- https://github.com/cneira/plugins
- https://github.com/codebench-dev/worker
- https://jvns.ca/blog/2021/01/27/day-47--using-device-mapper-to-manage-firecracker-images/
- https://github.com/firecracker-microvm/firecracker/blob/main/docs/mmds/mmds-user-guide.md
- https://www.koyeb.com/blog/the-koyeb-serverless-engine-from-kubernetes-to-nomad-firecracker-and-kuma
- https://stanislas.blog/2021/08/firecracker/
- https://webapp.io/blog/github-actions-10x-faster-with-firecracker/
- https://timperrett.com/2017/05/13/nomad-with-envoy-and-consul/
- https://firecracker-microvm.slack.com/archives/CG564DPTQ/p1650802849629629
- https://learn.hashicorp.com/collections/nomad/load-balancing
- https://discuss.hashicorp.com/t/creating-persistent-sessions-containers-with-nomad/38504/2
- https://learn.hashicorp.com/tutorials/nomad/prometheus-metrics
- https://github.com/firecracker-microvm/firecracker/blob/main/docs/prod-host-setup.md
- https://github.com/firecracker-microvm/firecracker/issues/329
- https://github.com/gitpod-io/openvscode-server
- https://www.packer.io/docs/datasources/hcp/hcp-packer-image
- https://kruzenshtern.org/run-a-firecracker-on-nomad/
- https://kruzenshtern.org/firecracker-network-setup/
- https://www.youtube.com/watch?v=CYCsa5e2vqg