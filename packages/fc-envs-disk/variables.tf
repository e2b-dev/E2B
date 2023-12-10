# ---------------------------------------------------------------------------------------------------------------------
# REQUIRED PARAMETERS
# You must provide a value for each of these parameters.
# ---------------------------------------------------------------------------------------------------------------------

variable "gcp_zone" {
  type        = string
  description = "The GCP zone to deploy to"
}

variable "fc_envs_disk_size" {
  type        = string
  description = "The size of the disk for storing built fc envs"
}

variable "prefix" {
  type        = string
  description = "The prefix to use for all resources in this module"
}


variable "labels" {
  description = "The labels to attach to resources created by this module"
  type        = map(string)
}
