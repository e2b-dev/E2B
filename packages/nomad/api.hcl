variable "gcp_zone" {
  type    = string
  default = "us-central1-a"
}

variable "image_name" {
  type    = string
  default = ""
}

variable "api_port_name" {
  type    = string
  default = ""
}

variable "api_port_number" {
  type    = number
  default = 0
}

variable "consul_token" {
  type    = string
  default = ""
}

variable "nomad_token" {
  type    = string
  default = ""
}

variable "nomad_address" {
  type    = string
  default = ""
}

variable "logs_proxy_address" {
  type    = string
  default = ""
}

variable "postgres_connection_string" {
  type    = string
  default = ""
}

variable "posthog_api_key" {
  type    = string
  default = ""
}

variable "environment" {
  type    = string
  default = ""
}

variable "docker_contexts_bucket_name" {
  type    = string
  default = ""
}

variable "api_secret" {
  type    = string
  default = ""
}

variable "google_service_account_secret" {
  type    = string
  default = ""
}

variable "gcp_docker_repository_name" {
  type    = string
  default = ""
}

variable "gcp_project_id" {
  type    = string
  default = ""
}

variable "gcp_region" {
  type    = string
  default = ""
}

job "orchestration-api" {
  datacenters = [var.gcp_zone]

  priority = 90

  group "api-service" {
    network {
      port "api" {
        static = var.api_port_number
      }
    }

    service {
      name = "api"
      port = var.api_port_number

      check {
        type     = "http"
        name     = "health"
        path     = "/health"
        interval = "20s"
        timeout  = "5s"
        port     = var.api_port_number
      }
    }

    task "start" {
      driver = "docker"

      resources {
        memory     = 2048
        memory_max = 2048
        cpu        = 1024
      }

      env {
        LOGS_PROXY_ADDRESS            = var.logs_proxy_address
        NOMAD_ADDRESS                 = var.nomad_address
        NOMAD_TOKEN                   = var.nomad_token
        CONSUL_TOKEN                  = var.consul_token
        SUPABASE_CONNECTION_STRING    = var.postgres_connection_string
        POSTHOG_API_KEY               = var.posthog_api_key
        ENVIRONMENT                   = var.environment
        GOOGLE_CLOUD_STORAGE_BUCKET   = var.docker_contexts_bucket_name
        API_SECRET                    = var.api_secret
        GOOGLE_SERVICE_ACCOUNT_BASE64 = var.google_service_account_secret
        GCP_DOCKER_REPOSITORY_NAME    = var.gcp_docker_repository_name
        GCP_PROJECT_ID                = var.gcp_project_id
        GCP_REGION                    = var.gcp_region
      }

      config {
        network_mode = "host"
        image        = var.image_name
        ports        = [var.api_port_name]
        args = [
          "--port", "${var.api_port_number}",
        ]
      }
    }
  }
}
