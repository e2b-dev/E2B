#!/bin/bash
# This script is meant to be run in the Startup Script of each Compute Instance while it's booting. The script uses the
# run-nomad and run-consul scripts to configure and start Consul and Nomad in server mode. Note that this script
# assumes it's running in a Google IMage built from the Packer template in examples/nomad-consul-image/nomad-consul.json.

set -e

# Send the log output from this script to user-data.log, syslog, and the console
# Inspired by https://alestic.com/2010/12/ec2-user-data-output/
exec > >(tee /var/log/user-data.log | logger -t user-data -s 2>/dev/console) 2>&1

gsutil cp gs://${scripts_bucket}/run-consul.sh /opt/consul/bin/run-consul.sh
gsutil cp gs://${scripts_bucket}/run-nomad.sh /opt/nomad/bin/run-nomad.sh

chmod +x /opt/consul/bin/run-consul.sh /opt/nomad/bin/run-nomad.sh

/opt/consul/bin/run-consul.sh --server --cluster-tag-name "${cluster_tag_name}" &
/opt/nomad/bin/run-nomad.sh --server --num-servers "${num_servers}"