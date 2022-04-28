# Orchestration Infrastructure

## TODO

### Sprint 1

Test run errors of the disk image

Is latest disk image deployed

Nomad address

### Sprint 2

Deploy proxy that allows to access sessions

Add rate limiting + monitoring

Update terraform files - parts of the files are taken from an older version of TF so there may ways to do something more efficiently

Do rolling updates

## Resources
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