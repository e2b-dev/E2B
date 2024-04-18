# ---------------------------------------------------------------------------------------------------------------------
# REQUIRED PARAMETERS
# You must provide a value for each of these parameters.
# ---------------------------------------------------------------------------------------------------------------------

variable "cluster_name" {
  description = "The name of the server cluster (e.g. server-stage). This variable is used to namespace all resources created by this module."
  type        = string
}

variable "machine_type" {
  description = "The machine type of the Compute Instance to run for each node in the cluster (e.g. n1-standard-1)."
  type        = string
}

variable "cluster_size" {
  description = "The number of nodes to have in the server cluster. We strongly recommended that you use either 3 or 5."
  type        = number
}

variable "image_family" {
  description = "The source image family used to create the boot disk for a Vault node. Only images based on Ubuntu 16.04 or 18.04 LTS are supported at this time."
  type        = string
}

variable "startup_script" {
  description = "A Startup Script to execute when the server first boots. We recommend passing in a bash script that executes the run-vault script, which should have been installed in the Vault Google Image by the install-vault module."
  type        = string
}

variable "cluster_tag_name" {
  type = string
}

variable "service_account_email" {
  description = "The email of the service account for the instance template."
  type        = string
}

variable "service_account_scopes" {
  description = "A list of service account scopes that will be added to the Compute Instance Template in addition to the scopes automatically added by this module."
  type        = list(string)
  default     = []
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
  default     = true
}

variable "network_name" {
  description = "The name of the VPC Network where all resources should be created."
  type        = string
}

variable "nomad_port" {
  description = "The port on which Nomad will listen for incoming connections."
  type        = number
}

variable "custom_tags" {
  description = "A list of tags that will be added to the Compute Instance Template in addition to the tags automatically added by this module."
  type        = list(string)
  default     = []
}

variable "labels" {
  description = "The labels to attach to resources created by this module"
  type        = map(string)
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
  default     = null
}

variable "instance_group_update_policy_max_surge_percent" {
  description = "The maximum number of instances(calculated as percentage) that can be created above the specified targetSize during the update process. Conflicts with var.instance_group_update_policy_max_surge_fixed. Only allowed for regional managed instance groups with size at least 10."
  type        = number
  default     = null
}

variable "instance_group_update_policy_max_unavailable_fixed" {
  description = "The maximum number of instances that can be unavailable during the update process. Conflicts with var.instance_group_update_policy_max_unavailable_percent. It has to be either 0 or at least equal to the number of zones. If fixed values are used, at least one of var.instance_group_update_policy_max_unavailable_fixed or var.instance_group_update_policy_max_surge_fixed must be greater than 0."
  type        = number
  default     = 1
}

variable "instance_group_update_policy_max_unavailable_percent" {
  description = "The maximum number of instances(calculated as percentage) that can be unavailable during the update process. Conflicts with var.instance_group_update_policy_max_unavailable_fixed. Only allowed for regional managed instance groups with size at least 10."
  type        = number
  default     = null
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

# Disk Settings

variable "root_volume_disk_size_gb" {
  description = "The size, in GB, of the root disk volume on each server node."
  type        = number
  default     = 20
}

variable "root_volume_disk_type" {
  description = "The GCE disk type. Can be either pd-ssd, local-ssd, or pd-standard"
  type        = string
  default     = "pd-ssd"
}
