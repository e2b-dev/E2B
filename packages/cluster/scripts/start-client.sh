#!/usr/bin/env bash

# This script is meant to be run in the User Data of each EC2 Instance while it's booting. The script uses the
# run-nomad and run-consul scripts to configure and start Nomad and Consul in client mode. Note that this script
# assumes it's running in an AMI built from the Packer template in examples/nomad-consul-ami/nomad-consul.json.

set -euo pipefail

# Send the log output from this script to user-data.log, syslog, and the console
# Inspired by https://alestic.com/2010/12/ec2-user-data-output/
exec > >(tee /var/log/user-data.log | logger -t user-data -s 2>/dev/console) 2>&1

# --- Mount the persistent disk with Firecracker environments.
# See https://cloud.google.com/compute/docs/disks/add-persistent-disk#create_disk
# TODO: Parametrize
disk_name="fc-envs"

mount_path="/mnt/disks/$disk_name"

mkdir -p $mount_path
mount /dev/disk/by-id/google-$disk_name $mount_path
chmod a+w $mount_path

# Mount env buckets
mkdir -p /mnt/disks/envs-pipeline
gcsfuse -o=allow_other --implicit-dirs e2b-fc-env-pipeline /mnt/disks/envs-pipeline

# Copy the kernel
env_pipeline_local_dir="/fc-vm"
mkdir -p $env_pipeline_local_dir
sudo cp /mnt/disks/envs-pipeline/envd $env_pipeline_local_dir/envd
sudo chmod +x $env_pipeline_local_dir/envd

mkdir -p /mnt/disks/docker-contexts
gcsfuse -o=allow_other --implicit-dirs e2b-envs-docker-context /mnt/disks/docker-contexts

# Setup Nomad task drivers
sudo rm -f /opt/nomad/plugins/env-build-task-driver
sudo rm -f /opt/nomad/plugins/env-instance-task-driver

sudo cp /mnt/disks/envs-pipeline/env-build-task-driver /opt/nomad/plugins/env-build-task-driver
sudo chmod +x /opt/nomad/plugins/env-build-task-driver

sudo cp /mnt/disks/envs-pipeline/env-instance-task-driver /opt/nomad/plugins/env-instance-task-driver
sudo chmod +x /opt/nomad/plugins/env-instance-task-driver

# These variables are passed in via Terraform template interpolation

gsutil cp gs://${scripts_bucket}/run-consul.sh /opt/consul/bin/run-consul.sh
gsutil cp gs://${scripts_bucket}/run-nomad.sh /opt/nomad/bin/run-nomad.sh

chmod +x /opt/consul/bin/run-consul.sh /opt/nomad/bin/run-nomad.sh

# These variables are passed in via Terraform template interpolation
/opt/consul/bin/run-consul.sh --client --cluster-tag-name "${cluster_tag_name}" &
/opt/nomad/bin/run-nomad.sh --client &
