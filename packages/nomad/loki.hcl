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

variable "consul_token" {
  type = string
}

job "loki" {
  datacenters = [var.gcp_zone]
  type        = "service"

  priority = 75

  group "loki-service" {
    count = 1

    network {
      port "loki" {
        to = var.loki_service_port_number
      }
    }

    service {
      name = "loki"
      port = var.loki_service_port_name

      check {
        type     = "http"
        path     = "/ready"
        interval = "20s"
        timeout  = "2s"
        port     = var.loki_service_port_number
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
  log_level: "debug"

analytics:
  reporting_enabled: false

common:
  path_prefix: /tmp/loki
  ring:
    kvstore:
      store: inmemory

schema_config:
 configs:
    - from: 2024-03-05
      store: boltdb-shipper
      object_store: gcs
      schema: v11
      index:
        prefix: loki_index_
        period: 24h

storage_config:
  gcs:
    bucket_name: "${var.loki_bucket_name}"
  boltdb_shipper:
    active_index_directory: local/boltdb-shipper-active
    cache_location: local/boltdb-shipper-cache
    cache_ttl: 24h
    shared_store: gcs

EOF

        destination = "local/loki-config.yml"
      }
    }
  }
}
