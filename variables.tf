variable "gcp_project_id" {
  description = "The project to deploy the cluster in"
  type        = string
  default     = "devbookhq"
}

variable "gcp_region" {
  type    = string
  default = "us-central1"
}

variable "gcp_zone" {
  description = "All GCP resources will be launched in this Zone."
  type        = string
  default     = "us-central1-a"
}
