# ---------------------------------------------------------------------------------------------------------------------
# REQUIRED PARAMETERS
# You must provide a value for each of these parameters.
# ---------------------------------------------------------------------------------------------------------------------

variable "cluster_name" {
  description = "The name of the server cluster (e.g. server-stage). This variable is used to namespace all resources created by this module."
  type        = string
  default     = "orch-server"
}

variable "cluster_tag_name" {
  description = "The tag name the Compute Instances will look for to automatically discover each other and form a cluster. TIP: If running more than one server Server cluster, each cluster should have its own unique tag name."
  type        = string
  default     = "orch-server"
}

variable "machine_type" {
  description = "The machine type of the Compute Instance to run for each node in the cluster (e.g. n1-standard-1)."
  type        = string
  default     = "n1-standard-1"
}

variable "cluster_size" {
  description = "The number of nodes to have in the server cluster. We strongly recommended that you use either 3 or 5."
  type        = number
  default     = 1
}

variable "image_family" {
  description = "The source image family used to create the boot disk for a Vault node. Only images based on Ubuntu 16.04 or 18.04 LTS are supported at this time."
  type        = string
  default     = "orch"
}

variable "startup_script" {
  description = "A Startup Script to execute when the server first boots. We recommend passing in a bash script that executes the run-server script, which should have been installed in the server Google Image by the install-server module."
  type        = string
  default     = "/opt/init/start-server.sh"
}

variable "shutdown_script" {
  description = "A Shutdown Script to execute when the server recieves a restart or stop event. We recommend passing in a bash script that executes the `server leave` command."
  type        = string
  default     = "/opt/init/stop.sh"
}

# ---------------------------------------------------------------------------------------------------------------------
# OPTIONAL PARAMETERS
# These parameters have reasonable defaults.
# ---------------------------------------------------------------------------------------------------------------------

variable "network_project_id" {
  description = "The name of the GCP Project where the network is located. Useful when using networks shared between projects. If empty, var.gcp_project_id will be used."
  type        = string
  default     = null
}

variable "service_account_scopes" {
  description = "A list of service account scopes that will be added to the Compute Instance Template in addition to the scopes automatically added by this module."
  type        = list(string)
  default     = []
}

variable "storage_access_scope" {
  description = "Used to set the access permissions for Google Cloud Storage. As of September 2018, this must be one of ['', 'storage-ro', 'storage-rw', 'storage-full']"
  type        = string
  default     = "storage-ro"
}

variable "instance_group_target_pools" {
  description = "To use a Load Balancer with the server cluster, you must populate this value. Specifically, this is the list of Target Pool URLs to which new Compute Instances in the Instance Group created by this module will be added. Note that updating the Target Pools attribute does not affect existing Compute Instances. Note also that use of a Load Balancer with server is generally discouraged; client should instead prefer to talk directly to the server where possible."
  type        = list(string)
  default     = []
}

variable "cluster_description" {
  description = "A description of the server cluster; it will be added to the Compute Instance Template."
  type        = string
  default     = null
}

variable "assign_public_ip_addresses" {
  description = "If true, each of the Compute Instances will receive a public IP address and be reachable from the Public Internet (if Firewall rules permit). If false, the Compute Instances will have private IP addresses only. In production, this should be set to false."
  type        = bool
  default     = false
}

variable "network_name" {
  description = "The name of the VPC Network where all resources should be created."
  type        = string
  default     = "default"
}

variable "subnetwork_name" {
  description = "The name of the VPC Subnetwork where all resources should be created. Defaults to the default subnetwork for the network and region."
  type        = string
  default     = null
}

variable "custom_tags" {
  description = "A list of tags that will be added to the Compute Instance Template in addition to the tags automatically added by this module."
  type        = list(string)
  default     = []
}

variable "service_account_email" {
  description = "The email of the service account for the instance template. If none is provided the google cloud provider project service account is used."
  type        = string
  default     = null
}

variable "allowed_inbound_cidr_blocks_http_api" {
  description = "A list of CIDR-formatted IP address ranges from which the Compute Instances will allow API connections to server."
  type        = list(string)
  default     = []
}

variable "allowed_inbound_tags_http_api" {
  description = "A list of tags from which the Compute Instances will allow API connections to server."
  type        = list(string)
  default     = []
}

variable "allowed_inbound_cidr_blocks_dns" {
  description = "A list of CIDR-formatted IP address ranges from which the Compute Instances will allow TCP DNS and UDP DNS connections to server."
  type        = list(string)
  default     = []
}

variable "allowed_inbound_tags_dns" {
  description = "A list of tags from which the Compute Instances will allow TCP DNS and UDP DNS connections to server."
  type        = list(string)
  default     = []
}

# Update Policy

variable "instance_group_update_policy_type" {
  description = "The type of update process. You can specify either PROACTIVE so that the instance group manager proactively executes actions in order to bring instances to their target versions or OPPORTUNISTIC so that no action is proactively executed but the update will be performed as part of other actions (for example, resizes or recreateInstances calls)."
  type        = string
  default     = "PROACTIVE"
}

variable "instance_group_update_policy_minimal_action" {
  description = "Minimal action to be taken on an instance. You can specify either 'RESTART' to restart existing instances or 'REPLACE' to delete and create new instances from the target template. If you specify a 'RESTART', the Updater will attempt to perform that action only. However, if the Updater determines that the minimal action you specify is not enough to perform the update, it might perform a more disruptive action."
  type        = string
  default     = "REPLACE"
}

variable "instance_group_update_policy_max_surge_fixed" {
  description = "The maximum number of instances that can be created above the specified targetSize during the update process. Conflicts with var.instance_group_update_policy_max_surge_percent. See https://www.terraform.io/docs/providers/google/r/compute_region_instance_group_manager.html#max_surge_fixed for more information."
  type        = number
  default     = 3
}

variable "instance_group_update_policy_max_surge_percent" {
  description = "The maximum number of instances(calculated as percentage) that can be created above the specified targetSize during the update process. Conflicts with var.instance_group_update_policy_max_surge_fixed. Only allowed for regional managed instance groups with size at least 10."
  type        = number
  default     = null
}

variable "instance_group_update_policy_max_unavailable_fixed" {
  description = "The maximum number of instances that can be unavailable during the update process. Conflicts with var.instance_group_update_policy_max_unavailable_percent. It has to be either 0 or at least equal to the number of zones. If fixed values are used, at least one of var.instance_group_update_policy_max_unavailable_fixed or var.instance_group_update_policy_max_surge_fixed must be greater than 0."
  type        = number
  default     = 0
}

variable "instance_group_update_policy_max_unavailable_percent" {
  description = "The maximum number of instances(calculated as percentage) that can be unavailable during the update process. Conflicts with var.instance_group_update_policy_max_unavailable_fixed. Only allowed for regional managed instance groups with size at least 10."
  type        = number
  default     = null
}

variable "instance_group_update_policy_min_ready_sec" {
  description = "Minimum number of seconds to wait for after a newly created instance becomes available. This value must be between 0-3600."
  type        = number
  default     = 300
}

# Metadata

variable "metadata_key_name_for_cluster_size" {
  description = "The key name to be used for the custom metadata attribute that represents the size of the server cluster."
  type        = string
  default     = "cluster-size"
}

variable "custom_metadata" {
  description = "A map of metadata key value pairs to assign to the Compute Instance metadata."
  type        = map(string)
  default     = {}
}

# Firewall Ports

variable "server_rpc_port" {
  description = "The port used by servers to handle incoming requests from other agents."
  type        = number
  default     = 8300
}

variable "cli_rpc_port" {
  description = "The port used by all agents to handle RPC from the CLI."
  type        = number
  default     = 8400
}

variable "serf_lan_port" {
  description = "The port used to handle gossip in the LAN. Required by all agents."
  type        = number
  default     = 8301
}

variable "serf_wan_port" {
  description = "The port used by servers to gossip over the WAN to other servers."
  type        = number
  default     = 8302
}

variable "http_api_port" {
  description = "The port used by clients to talk to the HTTP API"
  type        = number
  default     = 8500
}

variable "dns_port" {
  description = "The port used to resolve DNS queries."
  type        = number
  default     = 8600
}

# Disk Settings

variable "root_volume_disk_size_gb" {
  description = "The size, in GB, of the root disk volume on each server node."
  type        = number
  default     = 30
}

variable "root_volume_disk_type" {
  description = "The GCE disk type. Can be either pd-ssd, local-ssd, or pd-standard"
  type        = string
  default     = "pd-standard"
}
