variable "gcp_zone" {
  type = string
}

variable "loki_service_port_name" {
  type = string
}

variable "loki_service_port_number" {
  type = number
}

variable "loki_bucket_name" {
  type = string
}

job "loki" {
  datacenters = [var.gcp_zone]
  type        = "service"

  priority = 75

  group "loki-service" {
    count = 1

    network {
      port "loki-api" {
        to = var.loki_service_port_number
      }
    }

    service {
      name = "loki"
      port = var.loki_service_port_name

      check {
        type     = "http"
        path     = "/health"
        interval = "20s"
        timeout  = "2s"
      }
    }

    task "loki" {
      driver = "docker"

      config {
        image = "grafana/loki:2.9.5"

        args = [
          "-config.file",
          "local/loki-config.yml",
        ]
      }

      resources {
        cpu    = 500
        memory = 1024
      }

      template {
        data = <<EOF
auth_enabled: false

server:
  http_listen_port: ${var.loki_service_port_number}

gcs_storage_config:
  bucket_name: "${var.loki_bucket_name}"

EOF

        destination = "local/loki-config.yml"
      }
    }
  }
}
