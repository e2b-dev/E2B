variable "project_id" {
  type = string
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "The project_id must be a string of alphanumeric or hyphens, between 6 and 3o characters in length."
  }
  description = <<EOD
The GCP project identifier where the secret will be created.
EOD
}

variable "id" {
  type = string
  validation {
    condition     = can(regex("^[a-zA-Z0-9_-]{1,255}$", var.id))
    error_message = "The id must be a string of alphanumeric, hyphen, and underscore characters, and upto 255 characters in length."
  }
  description = <<EOD
The secret identifier to create; this value must be unique within the project.
EOD
}

variable "replication" {
  type = map(object({
    kms_key_name = string
  }))
  validation {
    condition     = length(var.replication) == 0 || length(distinct([for k, v in var.replication : v == null ? "x" : coalesce(lookup(v, "kms_key_name"), "unspecified") == "unspecified" ? "x" : "y"])) == 1
    error_message = "The replication must contain a Cloud KMS key for all regions, or an empty string/null for all regions."
  }
  default     = {}
  description = <<EOD
An optional map of replication configurations for the secret. If the map is empty
(default), then automatic replication will be used for the secret. If the map is
not empty, replication will be configured for each key (region) and, optionally,
will use the provided Cloud KMS keys.

NOTE: If Cloud KMS keys are used, a Cloud KMS key must be provided for every
region key.

E.g. to use automatic replication policy (default)
replication = {}

E.g. to force secrets to be replicated only in us-east1 and us-west1 regions,
with Google managed encryption keys
replication = {
  "us-east1" = null
  "us-west1" = null
}

E.g. to force secrets to be replicated only in us-east1 and us-west1 regions, but
use Cloud KMS keys from each region.
replication = {
  "us-east1" = { kms_key_name = "my-east-key-name" }
  "us-west1" = { kms_key_name = "my-west-key-name" }
}
EOD
}

variable "secret" {
  type        = string
  description = <<EOD
The secret payload to store in Secret Manager; if blank or null a versioned secret
value will NOT be created and must be populated outside of this module. Binary
values should be base64 encoded before use.
EOD
}

variable "accessors" {
  type    = list(string)
  default = []
  validation {
    condition     = length(join("", [for acct in var.accessors : can(regex("^(?:group|serviceAccount|user):[^@]+@[^@]*$", acct)) ? "x" : ""])) == length(var.accessors)
    error_message = "Each accessors value must be a valid IAM account identifier; e.g. user:jdoe@company.com, group:admins@company.com, serviceAccount:service@project.iam.gserviceaccount.com."
  }
  description = <<EOD
An optional list of IAM account identifiers that will be granted accessor (read-only)
permission to the secret.
EOD
}

variable "labels" {
  type        = map(string)
  default     = {}
  description = <<EOD
An optional map of label key:value pairs to assign to the secret resources.
Default is an empty map.
EOD
}
