# Resources

## General
- https://www.figma.com/file/pr02o1okRpScOmNpAmgvCL/Architecture
- https://www.hashicorp.com/blog/continuous-deployment-with-nomad-and-terraform
- https://medium.com/interleap/automating-terraform-deployment-to-google-cloud-with-github-actions-17516c4fb2e5
- https://learn.hashicorp.com/tutorials/waypoint/get-started-nomad?in=waypoint/get-started-nomad#setting-up-nomad-with-persistent-volumes
- https://github.com/hashicorp/terraform-google-nomad
- https://github.com/picatz/terraform-google-nomad (preemptible rolling?)
- https://github.com/picatz/terraform-google-nomad/issues/39
- https://github.com/picatz/terraform-google-nomad/issues/13
- https://stackoverflow.com/questions/64397938/how-to-integrate-terraform-state-into-github-action-workflow
- https://www.terraform.io/language/settings/backends/gcs
- https://todevornot.com/post/618457167027126272/gce-instance-with-persistent-disk-provisioned
- https://cloud.google.com/load-balancing/docs/l7-internal/int-https-lb-tf-examples

## API
- https://github.com/deepmap/oapi-codegen
- https://support.smartbear.com/swaggerhub/docs/tutorials/openapi-3-tutorial.html
- https://editor.swagger.io/

## Orchestrator disk image
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
- https://github.com/firecracker-microvm/firecracker-go-sdk
- https://github.com/hashicorp/nomad/blob/main/website/content/api-docs/volumes.mdx

## Envs pipeline
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
- https://jvns.ca/blog/2021/01/23/firecracker--start-a-vm-in-less-than-a-second/
- NIX
