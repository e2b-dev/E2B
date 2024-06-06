variable "gcp_zone" {
  type = string
}

variable "logs_port_number" {
  type = number
}

variable "logs_health_port_number" {
  type = string
}

variable "logs_health_path" {
  type = string
}

variable "logs_port_name" {
  type = string
}

variable "grafana_api_key" {
  type = string
}

variable "grafana_logs_username" {
  type = string
}

variable "grafana_logs_endpoint" {
  type = string
}

variable "loki_service_port_number" {
  type = number
}

job "logs-collector" {
  datacenters = [var.gcp_zone]
  type        = "service"

  priority = 85

  group "collector" {
    network {
      port "health" {
        to = var.logs_health_port_number
      }
      port "logs" {
        to = var.logs_port_number
      }
    }

    service {
      name = "logs-collector"
      port = "logs"
      tags = [
        "logs",
        "health",
      ]

      check {
        type     = "http"
        name     = "health"
        path     = var.logs_health_path
        interval = "20s"
        timeout  = "5s"
        port     = var.logs_health_port_number
      }
    }

    task "start-collector" {
      driver = "docker"

      config {
        network_mode = "host"
        image        = "timberio/vector:0.34.X-alpine"

        ports = [
          "health",
          "logs",
        ]
      }

      env {
        VECTOR_CONFIG          = "local/vector.toml"
        VECTOR_REQUIRE_HEALTHY = "true"
        VECTOR_LOG             = "warn"
      }

      resources {
        memory_max = 2048
        memory = 1024
        cpu    = 1024
      }

      template {
        destination   = "local/vector.toml"
        change_mode   = "signal"
        change_signal = "SIGHUP"
        # overriding the delimiters to [[ ]] to avoid conflicts with Vector's native templating, which also uses {{ }}
        left_delimiter  = "[["
        right_delimiter = "]]"
        data            = <<EOH
data_dir = "alloc/data/vector/"

[api]
enabled = true
address = "0.0.0.0:${var.logs_health_port_number}"

[sources.envd]
type = "http_server"
address = "0.0.0.0:${var.logs_port_number}"
encoding = "json"

[transforms.add_source_envd]
type = "remap"
inputs = ["envd"]
source = """
.service = "envd"
.sandboxID = .instanceID
if !exists(.envID) {
  .envID = "unknown"
}
"""

[sinks.local_loki_logs]
type = "loki"
inputs = [ "add_source_envd" ]
endpoint = "http://0.0.0.0:${var.loki_service_port_number}"
encoding.codec = "json"

[sinks.local_loki_logs.labels]
source = "logs-collector"
service = "{{ service }}"
teamID = "{{ teamID }}"
envID = "{{ envID }}"
sandboxID = "{{ sandboxID }}"

[sinks.grafana]
type = "loki"
inputs = [ "add_source_envd" ]
endpoint = "${var.grafana_logs_endpoint}"
encoding.codec = "json"
auth.strategy = "basic"
auth.user = "${var.grafana_logs_username}"
auth.password = "${var.grafana_api_key}"

[sinks.grafana.labels]
source = "logs-collector"
service = "{{ service }}"
teamID = "{{ teamID }}"
envID = "{{ envID }}"
sandboxID = "{{ sandboxID }}"

        EOH
      }
    }
  }
}
