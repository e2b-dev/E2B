# TODO: Rewrite everything to variables

variable "gcp_zone" {
  type    = string
  default = "us-central1-a"
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

variable "port_number" {
  type    = number
  default = 5000
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
        path     = "/health"
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
        POSTGRES_CONNECTION_STRING = var.postgres_connection_string
        GOOGLE_SERVICE_ACCOUNT_SECRET = var.google_service_account_secret
        GCP_PROJECT_ID = var.gcp_project_id
        DOCKER_REGISTRY = var.docker_registry
        DOMAIN_NAME = var.domain_name
      }

      config {
        network_mode = "host"
        image        = var.image_name
        ports        = ["docker-reverse-proxy"]
        args = [
          "--port", "${var.port_number}",
        ]
      }
    }
  }
}
