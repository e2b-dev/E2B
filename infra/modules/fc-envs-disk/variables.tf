# ---------------------------------------------------------------------------------------------------------------------
# REQUIRED PARAMETERS
# You must provide a value for each of these parameters.
# ---------------------------------------------------------------------------------------------------------------------

variable "gcp_project_id" {
  description = "The project to deploy the cluster in"
  type        = string
  default     = "devbookhq"
}
