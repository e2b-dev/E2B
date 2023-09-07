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

variable "betterstack_logs_api_key" {
  type = string
}

job "logs-collector" {
  datacenters = [var.gcp_zone]
  type        = "service"

  priority = 95

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
        image        = "timberio/vector:0.14.X-alpine"

        ports = [
          "health",
          "logs",
        ]
      }

      env {
        VECTOR_CONFIG          = "local/vector.toml"
        VECTOR_REQUIRE_HEALTHY = "true"
      }

      resources {
        memory = 128
        cpu    = 200
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

[sources.http_source]
type = "http"
address = "0.0.0.0:${var.logs_port_number}"
encoding = "json"

[transforms.logtail_transform_Ng2hNptjHFG5TLHYJnMKdrAY]
type = "remap"
inputs = [ "*" ]
source = '''
  del(.timestamp)
  .dt = now()
'''

[sinks.logtail_http_sink_Ng2hNptjHFG5TLHYJnMKdrAY]
type = "http"
inputs = [ "logtail_transform_Ng2hNptjHFG5TLHYJnMKdrAY" ]
uri = "https://in.logtail.com/"
encoding.codec = "json"
auth.strategy = "bearer"
auth.token = "${var.betterstack_logs_api_key}"
        EOH
      }
    }
  }
}
