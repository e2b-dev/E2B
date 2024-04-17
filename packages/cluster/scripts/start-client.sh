#!/usr/bin/env bash

# This script is meant to be run in the User Data of each EC2 Instance while it's booting. The script uses the
# run-nomad and run-consul scripts to configure and start Nomad and Consul in client mode. Note that this script
# assumes it's running in an AMI built from the Packer template in examples/nomad-consul-ami/nomad-consul.json.

set -euo pipefail

# Send the log output from this script to user-data.log, syslog, and the console
# Inspired by https://alestic.com/2010/12/ec2-user-data-output/
exec > >(tee /var/log/user-data.log | logger -t user-data -s 2>/dev/console) 2>&1

ulimit -n 65536
export GOMAXPROCS='nproc'

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

# Copy FC versions
mkdir -p /mnt/disks/fc-versions
gcsfuse -o=allow_other --implicit-dirs "${FC_VERSIONS_BUCKET_NAME}" /mnt/disks/fc-versions
fc_versions_dir="/fc-versions"
mkdir -p $fc_versions_dir
cp -r /mnt/disks/fc-versions/* $fc_versions_dir
chmod +x -R /fc-versions

# These variables are passed in via Terraform template interpolation

gsutil cp "gs://${SCRIPTS_BUCKET}/run-consul-${RUN_CONSUL_FILE_HASH}.sh" /opt/consul/bin/run-consul.sh
gsutil cp "gs://${SCRIPTS_BUCKET}/run-nomad-${RUN_NOMAD_FILE_HASH}.sh" /opt/nomad/bin/run-nomad.sh

chmod +x /opt/consul/bin/run-consul.sh /opt/nomad/bin/run-nomad.sh

mkdir -p /root/docker
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

# Set up huge pages
# We are not enabling Transparent Huge Pages for now, as they are not swappable and may result in slowdowns + we are not using swap right now.
# The THP are by default set to madvise
# We are allocating the hugepages at the start when the memory is not fragmented yet
echo "[Setting up huge pages]"
sudo mkdir -p /mnt/hugepages
mount -t hugetlbfs none /mnt/hugepages
# Increase proactive compaction to reduce memory fragmentation for using overcomitted huge pages

available_ram=$(grep MemTotal /proc/meminfo | awk '{print $2}') # in KiB
available_ram=$(($available_ram / 1024))                        # in MiB
echo "- Total memory: $available_ram MiB"

min_normal_ram=$((4 * 1024))                             # 4 GiB
min_normal_percentage_ram=$(($available_ram * 16 / 100)) # 16% of the total memory
max_normal_ram=$((42 * 1024))                            # 42 GiB

max() {
    if (($1 > $2)); then
        echo "$1"
    else
        echo "$2"
    fi
}

min() {
    if (($1 < $2)); then
        echo "$1"
    else
        echo "$2"
    fi
}

ensure_even() {
    if (($1 % 2 == 0)); then
        echo "$1"
    else
        echo $(($1 - 1))
    fi
}

remove_decimal() {
    echo "$(echo $1 | sed 's/\..*//')"
}

reserved_normal_ram=$(max $min_normal_ram $min_normal_percentage_ram)
reserved_normal_ram=$(min $reserved_normal_ram $max_normal_ram)
echo "- Reserved RAM: $reserved_normal_ram MiB"

# The huge pages RAM should still be usable for normal pages in most cases.
hugepages_ram=$(($available_ram - $reserved_normal_ram))
hugepages_ram=$(remove_decimal $hugepages_ram)
hugepages_ram=$(ensure_even $hugepages_ram)
echo "- RAM for hugepages: $hugepages_ram MiB"

hugepage_size_in_mib=2
echo "- Huge page size: $hugepage_size_in_mib MiB"
hugepages=$(($hugepages_ram / $hugepage_size_in_mib))

# This percentage will be permanently allocated for huge pages and in monitoring it will be shown as used.
base_hugepages_percentage=20
base_hugepages=$(($hugepages * $base_hugepages_percentage / 100))
base_hugepages=$(remove_decimal $base_hugepages)
echo "- Allocating $base_hugepages huge pages ($base_hugepages_percentage%) for base usage"
echo $base_hugepages >/proc/sys/vm/nr_hugepages

overcommitment_hugepages_percentage=$((100 - $base_hugepages_percentage))
overcommitment_hugepages=$(($hugepages * $overcommitment_hugepages_percentage / 100))
overcommitment_hugepages=$(remove_decimal $overcommitment_hugepages)
echo "- Allocating $overcommitment_hugepages huge pages ($overcommitment_hugepages_percentage%) for overcommitment"
echo $overcommitment_hugepages >/proc/sys/vm/nr_overcommit_hugepages

# These variables are passed in via Terraform template interpolation
/opt/consul/bin/run-consul.sh --client --cluster-tag-name "${CLUSTER_TAG_NAME}" --enable-gossip-encryption --gossip-encryption-key "${CONSUL_GOSSIP_ENCRYPTION_KEY}" &
/opt/nomad/bin/run-nomad.sh --client --consul-token "${CONSUL_TOKEN}" &
