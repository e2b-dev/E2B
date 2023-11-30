variable "gcp_project_id" {
  type        = string
  description = "The GCP project ID"
}

variable "gcp_region" {
  type        = string
  description = "The GCP region"
}

variable "gcp_service_account_email" {
  type        = string
  description = "The GCP service account email"
}

variable "labels" {
  description = "The labels to attach to resources created by this module"
  type        = map(string)
}
