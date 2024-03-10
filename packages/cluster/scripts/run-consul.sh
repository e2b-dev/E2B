#!/bin/bash
# This script is used to configure and run Consul on a Google Compute Instance.

set -e

# Import the appropriate bash commons libraries
readonly BASH_COMMONS_DIR="/opt/gruntwork/bash-commons"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

readonly CONSUL_CONFIG_FILE="default.json"
readonly SYSTEMD_CONFIG_PATH="/etc/systemd/system/consul.service"

readonly COMPUTE_INSTANCE_METADATA_URL="http://metadata.google.internal/computeMetadata/v1"
readonly GOOGLE_CLOUD_METADATA_REQUEST_HEADER="Metadata-Flavor: Google"
readonly CLUSTER_SIZE_INSTANCE_METADATA_KEY_NAME="cluster-size"

readonly DEFAULT_RAFT_PROTOCOL="3"

readonly DEFAULT_AUTOPILOT_CLEANUP_DEAD_SERVERS="true"
readonly DEFAULT_AUTOPILOT_LAST_CONTACT_THRESHOLD="200ms"
readonly DEFAULT_AUTOPILOT_MAX_TRAILING_LOGS="250"
readonly DEFAULT_AUTOPILOT_SERVER_STABILIZATION_TIME="10s"
readonly DEFAULT_AUTOPILOT_REDUNDANCY_ZONE_TAG="az"
readonly DEFAULT_AUTOPILOT_DISABLE_UPGRADE_MIGRATION="false"

if [[ ! -d "$BASH_COMMONS_DIR" ]]; then
  echo "ERROR: this script requires that bash-commons is installed in $BASH_COMMONS_DIR. See https://github.com/gruntwork-io/bash-commons for more info."
  exit 1
fi

source "$BASH_COMMONS_DIR/assert.sh"
source "$BASH_COMMONS_DIR/log.sh"
source "$BASH_COMMONS_DIR/os.sh"

function print_usage {
  echo
  echo "Usage: run-consul [OPTIONS]"
  echo
  echho "This script is used to configure and run Consul on a Google Compute Instance."
  echo
  echo "Options:"
  echo
  echo -e "  --server\t\tIf set, run in server mode. Optional. Exactly one of --server or --client must be set."
  echo -e "  --client\t\tIf set, run in client mode. Optional. Exactly one of --server or --client must be set."
  echo -e "  --consul-token\t\tThe Consul ACL token to use."
  echo -e "  --cluster-tag-name\tAutomatically form a cluster with Instances that have the same value for this Compute Instance tag name. Optional."
  echo -e "  --datacenter\t\tThe name of the datacenter Consul is running in. Optional. If not specified, will default to GCP region name."
  echo -e "  --config-dir\t\tThe path to the Consul config folder. Optional. Default is the absolute path of '../config', relative to this script."
  echo -e "  --data-dir\t\tThe path to the Consul data folder. Optional. Default is the absolute path of '../data', relative to this script."
  echo -e "  --systemd-stdout\t\tThe StandardOutput option of the systemd unit.  Optional.  If not configured, uses systemd's default (journal)."
  echo -e "  --systemd-stderr\t\tThe StandardError option of the systemd unit.  Optional.  If not configured, uses systemd's default (inherit)."
  echo -e "  --bin-dir\t\tThe path to the folder with Consul binary. Optional. Default is the absolute path of the parent folder of this script."
  echo -e "  --user\t\tThe user to run Consul as. Optional. Default is to use the owner of --config-dir."
  echo -e "  --enable-gossip-encryption\t\tEnable encryption of gossip traffic between nodes. Optional. Must also specify --gossip-encryption-key."
  echo -e "  --gossip-encryption-key\t\tThe key to use for encrypting gossip traffic. Optional. Must be specified with --enable-gossip-encryption."
  echo -e "  --enable-rpc-encryption\t\tEnable encryption of RPC traffic between nodes. Optional. Must also specify --ca-file-path, --cert-file-path and --key-file-path."
  echo -e "  --ca-path\t\tPath to the directory of CA files used to verify outgoing connections. Optional. Must be specified with --enable-rpc-encryption."
  echo -e "  --cert-file-path\tPath to the certificate file used to verify incoming connections. Optional. Must be specified with --enable-rpc-encryption and --key-file-path."
  echo -e "  --key-file-path\tPath to the certificate key used to verify incoming connections. Optional. Must be specified with --enable-rpc-encryption and --cert-file-path."
  echo -e "  --verify-server-hostname\tWhen passed in, enable server hostname verification as part of RPC encryption. Each server in Consul should get their own certificate that contains SERVERNAME.DATACENTERNAME.consul in the hostname or SAN. This prevents an authenticated agent from being converted into a server that streams all data, bypassing ACLs."
  echo -e "  --environment\t\tA single environment variable in the key/value pair form 'KEY=\"val\"' to pass to Consul as environment variable when starting it up. Repeat this option for additional variables. Optional."
  echo -e "  --skip-consul-config\tIf this flag is set, don't generate a Consul configuration file. Optional. Default is false."
  echo -e "  --recursor\tThis flag provides address of upstream DNS server that is used to recursively resolve queries if they are not inside the service domain for Consul. Repeat this option for additional variables. Optional."
  echo
  echo "Options for Consul Autopilot:"
  echo
  echo -e "  --autopilot-cleanup-dead-servers\tSet to true or false to control the automatic removal of dead server nodes periodically and whenever a new server is added to the cluster. Defaults to $DEFAULT_AUTOPILOT_CLEANUP_DEAD_SERVERS. Optional."
  echo -e "  --autopilot-last-contact-threshold\tControls the maximum amount of time a server can go without contact from the leader before being considered unhealthy. Must be a duration value such as 10s. Defaults to $DEFAULT_AUTOPILOT_LAST_CONTACT_THRESHOLD. Optional."
  echo -e "  --autopilot-max-trailing-logs\t\tControls the maximum number of log entries that a server can trail the leader by before being considered unhealthy. Defaults to $DEFAULT_AUTOPILOT_MAX_TRAILING_LOGS. Optional."
  echo -e "  --autopilot-server-stabilization-time\tControls the minimum amount of time a server must be stable in the 'healthy' state before being added to the cluster. Only takes effect if all servers are running Raft protocol version 3 or higher. Must be a duration value such as 30s. Defaults to $DEFAULT_AUTOPILOT_SERVER_STABILIZATION_TIME. Optional."
  echo -e "  --autopilot-redundancy-zone-tag\t\t(Enterprise-only) This controls the -node-meta key to use when Autopilot is separating servers into zones for redundancy. Only one server in each zone can be a voting member at one time. If left blank, this feature will be disabled. Defaults to $DEFAULT_AUTOPILOT_REDUNDANCY_ZONE_TAG. Optional."
  echo -e "  --autopilot-disable-upgrade-migration\t(Enterprise-only) If this flag is set, this will disable Autopilot's upgrade migration strategy in Consul Enterprise of waiting until enough newer-versioned servers have been added to the cluster before promoting any of them to voters. Defaults to $DEFAULT_AUTOPILOT_DISABLE_UPGRADE_MIGRATION. Optional."
  echo -e "  --autopilot-upgrade-version-tag\t\t(Enterprise-only) That tag to be used to override the version information used during a migration. Optional."
  echo
  echo
  echo "Example:"
  echo
  echo "  run-consul.sh --server --cluster-tag-name consul-xyz --config-dir /custom/path/to/consul/config"
}

# Get the value at a specific Instance Metadata path.
function get_instance_metadata_value {
  local -r path="$1"

  log_info "Looking up Metadata value at $COMPUTE_INSTANCE_METADATA_URL/$path"
  curl --silent --show-error --location --header "$GOOGLE_CLOUD_METADATA_REQUEST_HEADER" "$COMPUTE_INSTANCE_METADATA_URL/$path"
}

# Get the value of the given Custom Metadata Key
function get_instance_custom_metadata_value {
  local -r key="$1"

  log_info "Looking up Custom Instance Metadata value for key \"$key\""
  get_instance_metadata_value "instance/attributes/$key"
}

# Get the ID of the Project in which this Compute Instance currently resides
function get_instance_project_id {
  log_info "Looking up Project ID"
  get_instance_metadata_value "project/project-id"
}

# Get the GCE Region in which this Compute Instance currently resides
function get_instance_region {
  log_info "Looking up Region of the current Compute Instance"

  # The value returned for zone will be of the form "projects/121238320500/zones/us-west1-a" so we need to split the string
  # by "/" and return the 4th string.
  # Then we split again by '-' and return the first two fields.
  # from 'europe-west1-b' to 'europe-west1'
  get_instance_metadata_value "instance/zone" | cut -d'/' -f4 | awk -F'-' '{ print $1"-"$2 }'
}

# Get the ID of the current Compute Instance
function get_instance_name {
  log_info "Looking up current Compute Instance name"
  get_instance_metadata_value "instance/name"
}

# Get the IP Address of the current Compute Instance
function get_instance_ip_address {
  local network_interface_number="$1"

  # If no network interface number was specified, default to the first one
  if [[ -z "$network_interface_number" ]]; then
    network_interface_number=0
  fi

  log_info "Looking up Compute Instance IP Address on Network Interface $network_interface_number"
  get_instance_metadata_value "instance/network-interfaces/$network_interface_number/ip"
}

function split_by_lines {
  local prefix="$1"
  shift

  for var in "$@"; do
    echo "${prefix}${var}"
  done
}

function generate_consul_config {
  local -r server="${1}"
  local -r config_dir="${2}"
  local -r user="${3}"
  local -r cluster_tag_name="${4}"
  local -r cluster_size_instance_metadata_key_name="${5}"
  local -r datacenter="${6}"
  local -r enable_gossip_encryption="${7}"
  local -r gossip_encryption_key="${8}"
  local -r enable_rpc_encryption="${9}"
  local -r verify_server_hostname="${10}"
  local -r ca_path="${11}"
  local -r cert_file_path="${12}"
  local -r key_file_path="${13}"
  local -r cleanup_dead_servers="${14}"
  local -r last_contact_threshold="${15}"
  local -r max_trailing_logs="${16}"
  local -r server_stabilization_time="${17}"
  local -r redundancy_zone_tag="${18}"
  local -r disable_upgrade_migration="${19}"
  local -r upgrade_version_tag=${20}
  local -r config_path="$config_dir/$CONSUL_CONFIG_FILE"

  shift 20
  local -ar recursors=("$@")

  local instance_id=""
  local instance_name=""
  local project_id=""
  local instance_ip_address=""
  local instance_region=""
  local ui="false"

  instance_ip_address=$(get_instance_ip_address)
  instance_name=$(get_instance_name)
  instance_region=$(get_instance_region)
  project_id=$(get_instance_project_id)

  # Configure Cloud Auto Join. See https://www.consul.io/docs/install/cloud-auto-join#google-compute-engine for more info.
  local retry_join_json=""
  if [[ -z "$cluster_tag_name" ]]; then
    log_warn "The --cluster-tag-name property is empty. Will not automatically try to form a cluster based on Cluster Tag Name."
  else
    retry_join_json=$(
      cat <<EOF
"retry_join": ["provider=gce project_name=$project_id tag_value=$cluster_tag_name"],
EOF
    )
  fi

  local recursors_config=""
  if [[ ${#recursors[@]} -ne 0 ]]; then
    recursors_config="\"recursors\" : [ "
    for recursor in "${recursors[@]}"; do
      recursors_config="${recursors_config}\"${recursor}\", "
    done
    recursors_config=$(echo "${recursors_config}" | sed 's/, $//')" ],"
  fi

  local bootstrap_expect=""
  if [[ "$server" == "true" ]]; then
    local cluster_size=""

    cluster_size=$(get_instance_custom_metadata_value "$cluster_size_instance_metadata_key_name")

    bootstrap_expect="\"bootstrap_expect\": $cluster_size,"
    ui="true"
  fi

  local autopilot_configuration
  autopilot_configuration=$(
    cat <<EOF
"autopilot": {
  "cleanup_dead_servers": $cleanup_dead_servers,
  "last_contact_threshold": "$last_contact_threshold",
  "max_trailing_logs": $max_trailing_logs,
  "server_stabilization_time": "$server_stabilization_time",
  "redundancy_zone_tag": "$redundancy_zone_tag",
  "disable_upgrade_migration": $disable_upgrade_migration,
  "upgrade_version_tag": "$upgrade_version_tag"
},
EOF
  )

  local gossip_encryption_configuration=""
  if [[ "$enable_gossip_encryption" == "true" && -n "$gossip_encryption_key" ]]; then
    log_info "Creating gossip encryption configuration"
    gossip_encryption_configuration="\"encrypt\": \"$gossip_encryption_key\","
  fi

  local rpc_encryption_configuration=""
  if [[ "$enable_rpc_encryption" == "true" && -n "$ca_path" && -n "$cert_file_path" && -n "$key_file_path" ]]; then
    log_info "Creating RPC encryption configuration"
    rpc_encryption_configuration=$(
      cat <<EOF
"verify_outgoing": true,
"verify_incoming": true,
"verify_server_hostname": $verify_server_hostname,
"ca_path": "$ca_path",
"cert_file": "$cert_file_path",
"key_file": "$key_file_path",
EOF
    )
  fi

  log_info "Creating default Consul configuration"
  local default_config_json
  default_config_json=$(
    cat <<EOF
{
  "connect": {
    "enabled": true
  },
  "acl": {
    "enabled": true,
    "default_policy": "allow",
    "enable_token_persistence": true,
    "tokens": {
      "initial_management": "$CONSUL_ACL_MASTER_TOKEN"
    }
  },
  "telemetry": {
    "prometheus_retention_time": "24h",
    "disable_hostname": true
  },
  "limits": {
    "http_max_conns_per_client": 5000
  },
  "advertise_addr": "$instance_ip_address",
  "bind_addr": "$instance_ip_address",
  $bootstrap_expect
  "client_addr": "0.0.0.0",
  "datacenter": "$datacenter",
  "node_name": "$instance_id",
  "leave_on_terminate": true,
  "skip_leave_on_interrupt": true,
  $recursors_config
  $retry_join_json
  "server": $server,
  $gossip_encryption_configuration
  $rpc_encryption_configuration
  $autopilot_configuration
  "ui": $ui
}
EOF
  )

  log_info "Installing Consul config file in $config_path"
  echo "$default_config_json" | jq '.' >"$config_path"
  chown "$user:$user" "$config_path"
}

function generate_systemd_config {
  local -r systemd_config_path="$1"
  local -r consul_config_dir="$2"
  local -r consul_data_dir="$3"
  local -r consul_systemd_stdout="$4"
  local -r consul_systemd_stderr="$5"
  local -r consul_bin_dir="$6"
  local -r consul_user="$7"
  shift 7
  local -ar environment=("$@")
  local -r config_path="$consul_config_dir/$CONSUL_CONFIG_FILE"

  log_info "Creating systemd config file to run Consul in $systemd_config_path"

  local -r unit_config=$(
    cat <<EOF
[Unit]
Description="HashiCorp Consul - A service mesh solution"
Documentation=https://www.consul.io/
Requires=network-online.target
After=network-online.target
ConditionFileNotEmpty=$config_path
EOF
  )

  local -r service_config=$(
    cat <<EOF
[Service]
Type=notify
User=$consul_user
Group=$consul_user
ExecStart=$consul_bin_dir/consul agent -config-dir $consul_config_dir -data-dir $consul_data_dir
ExecReload=$consul_bin_dir/consul reload
ExecStop=$consul_bin_dir/consul leave
KillMode=process
Restart=on-failure
TimeoutSec=300s
LimitNOFILE=65536
$(split_by_lines "Environment=" "${environment[@]}")
EOF
  )

  local log_config=""
  if [[ -n $consul_systemd_stdout ]]; then
    log_config+="StandardOutput=$consul_systemd_stdout\n"
  fi
  if [[ -n $consul_systemd_stderr ]]; then
    log_config+="StandardError=$consul_systemd_stderr\n"
  fi

  local -r install_config=$(
    cat <<EOF
[Install]
WantedBy=multi-user.target
EOF
  )

  echo -e "$unit_config" >"$systemd_config_path"
  echo -e "$service_config" >>"$systemd_config_path"
  echo -e "$log_config" >>"$systemd_config_path"
  echo -e "$install_config" >>"$systemd_config_path"
}

function start_consul {
  log_info "Reloading systemd config and starting Consul"

  sudo systemctl daemon-reload
  sudo systemctl enable consul.service
  sudo systemctl restart consul.service
}

function bootstrap {
  log_info "Waiting for Consul to start"
  while true; do
    local readonly consul_leader_addr=$(consul info | grep "leader_addr =" | awk -F'=' '{print $2}' | tr -d  ' ')
    local readonly consul_leader=$(consul info | grep "leader =" | awk -F'=' '{print $2}' | tr -d  ' ')
    if [[ -n "$consul_leader_addr" ]]; then
      log_info "Consul leader elected"

      if [[ "$consul_leader" == "true" ]]; then
        local readonly consul_token="$1"
        log_info "Bootstrapping Consul"
        echo "${consul_token}" > /tmp/consul.token
        consul acl bootstrap /tmp/consul.token
        rm /tmp/consul.token
      fi

      break
    fi


    log_info "Waiting for Consul to start"
    sleep 1
  done
}

# Based on: http://unix.stackexchange.com/a/7732/215969
function get_owner_of_path {
  local -r path="$1"
  ls -ld "$path" | awk '{print $3}'
}

function get_owner_home_dir {
  local -r user="$1"

  local home_dir=""
  home_dir=$(sudo su - $user -c 'echo $HOME')

  if [[ "$home_dir" == "/" ]]; then
    log_error "No \$HOME directory is set for user $user. This may cause unpredictable behavior with Consul in GCP. Exiting."
    exit 1
  fi

  echo "$home_dir"
}

function run {
  local server="false"
  local client="false"
  local config_dir=""
  local data_dir=""
  local systemd_stdout=""
  local systemd_stderr=""
  local bin_dir=""
  local user=""
  local cluster_tag_name=""
  local datacenter=""
  local upgrade_version_tag=""
  local enable_gossip_encryption="false"
  local gossip_encryption_key=""
  local enable_rpc_encryption="false"
  local verify_server_hostname="false"
  local ca_path=""
  local cert_file_path=""
  local key_file_path=""
  local environment=()
  local skip_consul_config="false"
  local recursors=()
  local cleanup_dead_servers="$DEFAULT_AUTOPILOT_CLEANUP_DEAD_SERVERS"
  local last_contact_threshold="$DEFAULT_AUTOPILOT_LAST_CONTACT_THRESHOLD"
  local max_trailing_logs="$DEFAULT_AUTOPILOT_MAX_TRAILING_LOGS"
  local server_stabilization_time="$DEFAULT_AUTOPILOT_SERVER_STABILIZATION_TIME"
  local redundancy_zone_tag="$DEFAULT_AUTOPILOT_REDUNDANCY_ZONE_TAG"
  local disable_upgrade_migration="$DEFAULT_AUTOPILOT_DISABLE_UPGRADE_MIGRATION"

  while [[ $# -gt 0 ]]; do
    local key="$1"

    case "$key" in
    --server)
      server="true"
      ;;
    --client)
      client="true"
      ;;
    --consul-token)
      assert_not_empty "$key" "$2"
      consul_token="$2"
      shift
      ;;
    --config-dir)
      assert_not_empty "$key" "$2"
      config_dir="$2"
      shift
      ;;
    --data-dir)
      assert_not_empty "$key" "$2"
      data_dir="$2"
      shift
      ;;
    --systemd-stdout)
      assert_not_empty "$key" "$2"
      systemd_stdout="$2"
      shift
      ;;
    --systemd-stderr)
      assert_not_empty "$key" "$2"
      systemd_stderr="$2"
      shift
      ;;
    --bin-dir)
      assert_not_empty "$key" "$2"
      bin_dir="$2"
      shift
      ;;
    --user)
      assert_not_empty "$key" "$2"
      user="$2"
      shift
      ;;
    --cluster-tag-name)
      assert_not_empty "$key" "$2"
      cluster_tag_name="$2"
      shift
      ;;
    --datacenter)
      assert_not_empty "$key" "$2"
      datacenter="$2"
      shift
      ;;
    --autopilot-cleanup-dead-servers)
      assert_not_empty "$key" "$2"
      cleanup_dead_servers="$2"
      shift
      ;;
    --autopilot-last-contact-threshold)
      assert_not_empty "$key" "$2"
      last_contact_threshold="$2"
      shift
      ;;
    --autopilot-max-trailing-logs)
      assert_not_empty "$key" "$2"
      max_trailing_logs="$2"
      shift
      ;;
    --autopilot-server-stabilization-time)
      assert_not_empty "$key" "$2"
      server_stabilization_time="$2"
      shift
      ;;
    --autopilot-redundancy-zone-tag)
      assert_not_empty "$key" "$2"
      redundancy_zone_tag="$2"
      shift
      ;;
    --autopilot-disable-upgrade-migration)
      disable_upgrade_migration="true"
      shift
      ;;
    --autopilot-upgrade-version-tag)
      assert_not_empty "$key" "$2"
      upgrade_version_tag="$2"
      shift
      ;;
    --enable-gossip-encryption)
      enable_gossip_encryption="true"
      ;;
    --gossip-encryption-key)
      assert_not_empty "$key" "$2"
      gossip_encryption_key="$2"
      shift
      ;;
    --enable-rpc-encryption)
      enable_rpc_encryption="true"
      ;;
    --verify-server-hostname)
      verify_server_hostname="true"
      ;;
    --ca-path)
      assert_not_empty "$key" "$2"
      ca_path="$2"
      shift
      ;;
    --cert-file-path)
      assert_not_empty "$key" "$2"
      cert_file_path="$2"
      shift
      ;;
    --key-file-path)
      assert_not_empty "$key" "$2"
      key_file_path="$2"
      shift
      ;;
    --environment)
      assert_not_empty "$key" "$2"
      environment+=("$2")
      shift
      ;;
    --skip-consul-config)
      skip_consul_config="true"
      ;;
    --recursor)
      assert_not_empty "$key" "$2"
      recursors+=("$2")
      shift
      ;;
    --help)
      print_usage
      exit
      ;;
    *)
      log_error "Unrecognized argument: $key"
      print_usage
      exit 1
      ;;
    esac

    shift
  done

  if [[ ("$server" == "true" && "$client" == "true") || ("$server" == "false" && "$client" == "false") ]]; then
    log_error "Exactly one of --server or --client must be set."
    exit 1
  fi

  assert_is_installed "systemctl"
  assert_is_installed "curl"
  assert_is_installed "jq"

  if [[ -z "$config_dir" ]]; then
    config_dir=$(cd "$SCRIPT_DIR/../config" && pwd)
  fi

  if [[ -z "$data_dir" ]]; then
    data_dir=$(cd "$SCRIPT_DIR/../data" && pwd)
  fi

  # If $systemd_stdout and/or $systemd_stderr are empty, we leave them empty so that generate_systemd_config will use systemd's defaults (journal and inherit, respectively)

  if [[ -z "$bin_dir" ]]; then
    bin_dir=$(cd "$SCRIPT_DIR/../bin" && pwd)
  fi

  if [[ -z "$user" ]]; then
    user=$(get_owner_of_path "$config_dir")
  fi

  if [[ -z "$datacenter" ]]; then
    datacenter=$(get_instance_region)
  fi

  if [[ "$skip_consul_config" == "true" ]]; then
    log_info "The --skip-consul-config flag is set, so will not generate a default Consul config file."
  else
    if [[ "$enable_gossip_encryption" == "true" ]]; then
      assert_not_empty "--gossip-encryption-key" "$gossip_encryption_key"
    fi
    if [[ "$enable_rpc_encryption" == "true" ]]; then
      assert_not_empty "--ca-path" "$ca_path"
      assert_not_empty "--cert-file-path" "$cert_file_path"
      assert_not_empty "--key_file_path" "$key_file_path"
    fi

    generate_consul_config "$server" \
      "$config_dir" \
      "$user" \
      "$cluster_tag_name" \
      "$CLUSTER_SIZE_INSTANCE_METADATA_KEY_NAME" \
      "$datacenter" \
      "$enable_gossip_encryption" \
      "$gossip_encryption_key" \
      "$enable_rpc_encryption" \
      "$verify_server_hostname" \
      "$ca_path" \
      "$cert_file_path" \
      "$key_file_path" \
      "$cleanup_dead_servers" \
      "$last_contact_threshold" \
      "$max_trailing_logs" \
      "$server_stabilization_time" \
      "$redundancy_zone_tag" \
      "$disable_upgrade_migration" \
      "$upgrade_version_tag" \
      "${recursors[@]}"
  fi

  generate_systemd_config "$SYSTEMD_CONFIG_PATH" "$config_dir" "$data_dir" "$systemd_stdout" "$systemd_stderr" "$bin_dir" "$user" "${environment[@]}"
  start_consul

  if [[ "$server" == "true" ]]; then
    bootstrap "$consul_token"
  fi
}

run "$@"
