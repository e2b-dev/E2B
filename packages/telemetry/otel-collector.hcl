variable "gcp_zone" {
  type = string
}

variable "grafana_api_key" {
  type = string
}

variable "grafana_logs_username" {
  type = string
}

variable "grafana_traces_username" {
  type = string
}

variable "grafana_metrics_username" {
  type = string
}

variable "grafana_logs_endpoint" {
  type = string
}

variable "grafana_traces_endpoint" {
  type = string
}

variable "grafana_metrics_endpoint" {
  type = string
}

variables {
  otel_image = "otel/opentelemetry-collector-contrib:0.88.0"
}

job "otel-collector" {
  datacenters = [var.gcp_zone]
  type        = "service"

  priority = 95

  group "collector" {
    count = 1

    network {
      port "health" {
        to = 13133
      }

      port "metrics" {
        to = 8888
      }

      # Receivers
      port "grpc" {
        to = 4317
      }

      port "http" {
        to = 4318
      }
    }

    service {
      name = "otel-collector"
      port = "grpc"
      tags = ["grpc"]

      check {
        type     = "http"
        name     = "health"
        path     = "/health"
        interval = "20s"
        timeout  = "5s"
        port     = 13133
      }
    }

    task "start-collector" {
      driver = "docker"

      config {
        network_mode = "host"
        image        = var.otel_image

        args = [
          "--config=local/config/otel-collector-config.yaml",
        ]

        ports = [
          "metrics",
          "grpc",
          "health",
          "http",
        ]
      }

      resources {
        memory = 400
        cpu    = 400
      }

      template {
        data = <<EOF
receivers:
  otlp:
    protocols:
      grpc:
      http:
  prometheus:
    config:
      scrape_configs:
        - job_name: integrations/nomad
          scrape_interval: 15s
          scrape_timeout: 5s
          metrics_path: "/v1/metrics"
          params:
            format: ["prometheus"]
          static_configs:
            - targets: ["localhost:4646"]
          metric_relabel_configs:
            - action: keep
              regex: nomad_client_allocated_cpu|nomad_client_allocated_disk|nomad_client_allocated_memory|nomad_client_allocs_cpu_total_percent|nomad_client_allocs_cpu_total_ticks|nomad_client_allocs_memory_cache|nomad_client_allocs_memory_rss|nomad_client_host_cpu_idle|nomad_client_host_disk_available|nomad_client_host_disk_inodes_percent|nomad_client_host_disk_size|nomad_client_host_memory_available|nomad_client_host_memory_free|nomad_client_host_memory_total|nomad_client_host_memory_used|nomad_client_unallocated_cpu|nomad_client_unallocated_disk|nomad_client_unallocated_memory|nomad_client_uptime
              source_labels:
                - __name__

processors:
  batch:

extensions:
  basicauth/grafana_cloud_traces:
    client_auth:
      username: "${var.grafana_traces_username}"
      password: "${var.grafana_api_key}"
  basicauth/grafana_cloud_metrics:
    client_auth:
      username: "${var.grafana_metrics_username}"
      password: "${var.grafana_api_key}"
  basicauth/grafana_cloud_logs:
    client_auth:
      username: "${var.grafana_logs_username}"
      password: "${var.grafana_api_key}"
  health_check:

exporters:
  otlp/grafana_cloud_traces:
    endpoint: "${var.grafana_traces_endpoint}"
    auth:
      authenticator: basicauth/grafana_cloud_traces
  loki/grafana_cloud_logs:
    endpoint: "${var.grafana_logs_endpoint}"
    auth:
      authenticator: basicauth/grafana_cloud_logs
  prometheusremotewrite/grafana_cloud_metrics:
    endpoint: "${var.grafana_metrics_endpoint}"
    auth:
      authenticator: basicauth/grafana_cloud_metrics

service:
  extensions:
    - basicauth/grafana_cloud_traces
    - basicauth/grafana_cloud_metrics
    - basicauth/grafana_cloud_logs
    - health_check
  pipelines:
    metrics:
      receivers:
        - prometheus
        - otlp
      processors: [batch]
      exporters:
        - prometheusremotewrite/grafana_cloud_metrics
    traces:
      receivers:
        - otlp
      processors: [batch]
      exporters:
        - otlp/grafana_cloud_traces
    logs:
      receivers:
        - otlp
      processors: [batch]
      exporters:
        - loki/grafana_cloud_logs

EOF

        destination = "local/config/otel-collector-config.yaml"
      }
    }
  }
}
