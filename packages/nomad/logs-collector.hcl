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

variable "loki_endpoint" {
  type = string
}

job "logs-collector" {
  datacenters = [var.gcp_zone]
  type        = "service"

  priority = 85

  group "collector" {
    count = 1

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
        VECTOR_LOG             = "debug"
      }

      resources {
        memory = 256
        cpu    = 256
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

[sources.vector]
type = "internal_logs"

[transforms.add_source_vector]
type = "remap"
inputs = ["vector"]
source = """
.service = "vector"
"""

[sources.envd]
type = "http_server"
address = "0.0.0.0:${var.logs_port_number}"
encoding = "json"

[transforms.add_source_envd]
type = "remap"
inputs = ["envd"]
source = """
.service = "envd"
"""

# TODO: Send envd logs to the new on prem loki sink

[sinks.local_loki_logs]
type = "loki"
inputs = [ "add_source_envd" ]
endpoint = "${var.loki_endpoint}"
encoding.codec = "json"

[sinks.grafana]
type = "loki"
inputs = [ "add_source_envd", "add_source_vector" ]
endpoint = "${var.grafana_logs_endpoint}"
encoding.codec = "json"
auth.strategy = "basic"
auth.user = "${var.grafana_logs_username}"
auth.password = "${var.grafana_api_key}"

[sinks.grafana.labels]
source = "logs-collector"
service = "{{ service }}"

        EOH
      }
    }
  }
}
