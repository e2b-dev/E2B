# Orchestration Services
Backend services for handling VM sessions, environments' pipeline, and the API for them.

## [Infrastructure](/infra/)
Codified setup of all services that deploys them on GCP.

## [Orchestration](/orch/)
Nomad based system for managing services and handling provisioning of VM sessions. It uses Consul and Envoy for networking and monitoring.

## [Environments](/env/)
Pipeline for building rootfs and snapshots from provided dockerfiles. These files are then used for provisioning VMs.

## [API](/api/)
API for managing VM sessions and environments' pipeline.
