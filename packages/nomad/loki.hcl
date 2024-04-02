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
        network_mode = "host"
        image = "grafana/loki:2.8.4"

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
  log_level: "warn"

analytics:
  reporting_enabled: true

common:
  path_prefix: /loki
  replication_factor: 1
  ring:
    kvstore:
      consul:
        acl_token: "${var.consul_token}"

storage_config:
  gcs:
    bucket_name: "${var.loki_bucket_name}"
  tsdb_shipper:
    active_index_directory: /loki/tsdb-shipper-active
    cache_location: /loki/tsdb-shipper-cache
    cache_ttl: 24h
    shared_store: gcs

schema_config:
 configs:
    - from: 2024-03-05
      store: tsdb
      object_store: gcs
      schema: v12
      index:
        prefix: loki_index_
        period: 24h

compactor:
  working_directory: /loki/compactor
  compaction_interval: 1m
  retention_enabled: true
  retention_delete_delay: 2h
  retention_delete_worker_count: 150
  shared_store: gcs

# The bucket lifecycle policy should be set to delete objects after MORE than the specified retention period
limits_config:
  retention_period: 168h


EOF

        destination = "local/loki-config.yml"
      }
    }
  }
}
