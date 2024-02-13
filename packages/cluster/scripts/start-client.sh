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

mount_path="/mnt/disks/${DISK_DEVICE_NAME}"

mkdir -p "$mount_path"

# Format the disk if it is not already formatted.
if [[ $(lsblk -no FSTYPE "/dev/disk/by-id/google-${DISK_DEVICE_NAME}") != "xfs" ]]; then
    mkfs.xfs "/dev/disk/by-id/google-${DISK_DEVICE_NAME}"
fi

mount "/dev/disk/by-id/google-${DISK_DEVICE_NAME}" "$mount_path"
chmod a+w "$mount_path"

# Mount env buckets
mkdir -p /mnt/disks/envs-pipeline
gcsfuse -o=allow_other --implicit-dirs "${FC_ENV_PIPELINE_BUCKET_NAME}" /mnt/disks/envs-pipeline

# Copy the envd
env_pipeline_local_dir="/fc-vm"
mkdir -p $env_pipeline_local_dir
sudo cp /mnt/disks/envs-pipeline/envd $env_pipeline_local_dir/envd
sudo chmod +x $env_pipeline_local_dir/envd

# Copy kernels
mkdir -p /mnt/disks/fc-kernels
gcsfuse -o=allow_other --implicit-dirs "${FC_KERNELS_BUCKET_NAME}" /mnt/disks/fc-kernels
kernels_dir="/fc-kernels"
mkdir -p $kernels_dir
cp -r /mnt/disks/fc-kernels/* $kernels_dir

# Mount docker contexts
mkdir -p /mnt/disks/docker-contexts
gcsfuse -o=allow_other --implicit-dirs "${DOCKER_CONTEXTS_BUCKET_NAME}" /mnt/disks/docker-contexts

# Setup Nomad task drivers
sudo rm -f /opt/nomad/plugins/env-build-task-driver
sudo rm -f /opt/nomad/plugins/env-instance-task-driver
sudo rm -f /opt/nomad/plugins/template-delete-task-driver

sudo cp /mnt/disks/envs-pipeline/env-build-task-driver /opt/nomad/plugins/env-build-task-driver
sudo chmod +x /opt/nomad/plugins/env-build-task-driver

sudo cp /mnt/disks/envs-pipeline/template-delete-task-driver /opt/nomad/plugins/template-delete-task-driver
sudo chmod +x /opt/nomad/plugins/template-delete-task-driver

sudo cp /mnt/disks/envs-pipeline/env-instance-task-driver /opt/nomad/plugins/env-instance-task-driver
sudo chmod +x /opt/nomad/plugins/env-instance-task-driver

# These variables are passed in via Terraform template interpolation

gsutil cp "gs://${SCRIPTS_BUCKET}/run-consul-${RUN_CONSUL_FILE_HASH}.sh" /opt/consul/bin/run-consul.sh
gsutil cp "gs://${SCRIPTS_BUCKET}/run-nomad-${RUN_NOMAD_FILE_HASH}.sh" /opt/nomad/bin/run-nomad.sh

chmod +x /opt/consul/bin/run-consul.sh /opt/nomad/bin/run-nomad.sh

mkdir /root/docker
touch /root/docker/config.json
cat <<EOF >/root/docker/config.json
{
    "auths": {
        "${GCP_REGION}-docker.pkg.dev": {
            "username": "_json_key_base64",
            "password": "${GOOGLE_SERVICE_ACCOUNT_KEY}",
            "server_address": "https://${GCP_REGION}-docker.pkg.dev"
        }
    }
}
EOF

# These variables are passed in via Terraform template interpolation
/opt/consul/bin/run-consul.sh --client --cluster-tag-name "${CLUSTER_TAG_NAME}" &
/opt/nomad/bin/run-nomad.sh --client --consul-token "${CONSUL_TOKEN}" &
