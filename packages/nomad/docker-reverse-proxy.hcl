variable "gcp_zone" {
  type    = string
  default = ""
}

variable "gcp_region" {
  type    = string
  default = ""
}

variable "gcp_project_id" {
  type    = string
  default = ""
}

variable "image_name" {
  type    = string
  default = ""
}

variable "domain_name" {
  type    = string
  default = ""
}

variable "docker_registry" {
  type    = string
  default = ""
}

variable "health_check_path" {
    type    = string
    default = "/health"
}

variable "port_number" {
  type    = number
  default = 5000
}

variable "port_name" {
  type    = string
  default = ""
}

variable "postgres_connection_string" {
  type    = string
  default = ""
}

variable "google_service_account_secret" {
  type    = string
  default = ""
}

job "docker-reverse-proxy" {
  datacenters = [var.gcp_zone]

  priority = 90

  group "reverse-proxy" {
    network {
      port "docker-reverse-proxy" {
        static = var.port_number
      }
    }

    service {
      name = "docker-reverse-proxy"
      port = var.port_number

      check {
        type     = "http"
        name     = "health"
        path     = var.health_check_path
        interval = "20s"
        timeout  = "5s"
        port     = var.port_number
      }
    }

    task "start" {
      driver = "docker"

      resources {
        memory     = 1024
        memory_max = 1024
        cpu        = 512
      }

      env {
        POSTGRES_CONNECTION_STRING    = var.postgres_connection_string
        GOOGLE_SERVICE_ACCOUNT_BASE64 = var.google_service_account_secret
        GCP_REGION                    = var.gcp_region
        GCP_PROJECT_ID                = var.gcp_project_id
        GCP_DOCKER_REPOSITORY_NAME    = var.docker_registry
        DOMAIN_NAME                   = var.domain_name
      }

      config {
        network_mode = "host"
        image        = var.image_name
        ports        = [var.port_name]
        args = [
          "--port", "${var.port_number}",
        ]
      }
    }
  }
}
