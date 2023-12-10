variable "prefix" {
  type = string
}

variable "gcp_project_id" {
  type = string
}
variable "gcp_region" {
  type = string
}

variable "google_service_account_email" {
  type = string
}

variable "labels" {
  description = "The labels to attach to resources created by this module"
  type        = map(string)
}

variable "orchestration_repository_name" {
  type = string
}