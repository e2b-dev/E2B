variable "gcp_zone" {
  type = string
}

variable "grafana_api_key" {
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
        endpoint: "0.0.0.0:4317"
  nginx/client-proxy:
    endpoint: "http://localhost:3001/status"
    collection_interval: 60s
  nginx/session-proxy:
    endpoint: "http://localhost:3004/status"
    collection_interval: 60s
  hostmetrics:
    collection_interval: 30s
    scrapers:
      cpu:
      disk:
      filesystem:
      load:
      memory:
      network:
      paging:
      process:
      processes:
  prometheus:
    config:
      scrape_configs:
        - job_name: integrations/nomad
          scrape_interval: 10s
          scrape_timeout: 5s
          metrics_path: "/v1/metrics"
          params:
            format: ["prometheus"]
          static_configs:
            - targets:
                [
                  "nomad1:4646",
                  "nomad2:4646",
                  "nomad3:4646",
                  "nomad-client1:4646",
                  "localhost:4646",
                ]
          metric_relabel_configs:
            - action: keep
              regex: nomad_client_allocated_cpu|nomad_client_allocated_disk|nomad_client_allocated_memory|nomad_client_allocs_cpu_total_percent|nomad_client_allocs_cpu_total_ticks|nomad_client_allocs_memory_cache|nomad_client_allocs_memory_rss|nomad_client_host_cpu_idle|nomad_client_host_disk_available|nomad_client_host_disk_inodes_percent|nomad_client_host_disk_size|nomad_client_host_memory_available|nomad_client_host_memory_free|nomad_client_host_memory_total|nomad_client_host_memory_used|nomad_client_unallocated_cpu|nomad_client_unallocated_disk|nomad_client_unallocated_memory|nomad_client_uptime
              source_labels:
                - __name__
        - job_name: integrations/consul
          scrape_interval: 60s
          scrape_timeout: 5s
          metrics_path: "/v1/agent/metrics"
          params:
            format: ["prometheus"]
          static_configs:
            - targets: ["localhost:8500"]
          relabel_configs:
            - replacement: "integrations/consul"
              target_label: job
          metric_relabel_configs:
            - action: keep
              regex: consul_raft_leader|consul_raft_leader_lastcontact_count|consul_raft_peers|consul_up
              source_labels:
                - __name__

processors:
  attributes/session-proxy:
    actions:
      - key: proxy
        value: session
        action: upsert
  attributes/client-proxy:
    actions:
      - key: proxy
        value: client
        action: upsert
  batch:
  resourcedetection:
    detectors: [gcp]
  metricstransform:
    transforms:
      - include: "host.name"
        action: update
        new_name: "hostname"
      - include: "process.pid"
        action: update
        new_name: "pid"
      - include: "process.executable.name"
        action: update
        new_name: "binary"

extensions:
  bearertokenauth/grafana:
    token: "${var.grafana_api_key}"
  health_check:

exporters:
  otlp/grafana_cloud_traces:
    endpoint: "${var.grafana_traces_endpoint}"
    auth:
      authenticator: bearertokenauth/grafana

  loki/grafana_cloud_logs:
    endpoint: "${var.grafana_logs_endpoint}"
    auth:
      authenticator: bearertokenauth/grafana

  prometheusremotewrite/grafana_cloud_metrics:
    endpoint: "${var.grafana_metrics_endpoint}"
    auth:
      authenticator: bearertokenauth/grafana

service:
  extensions:
    - bearertokenauth/grafana
    - health_check
  pipelines:
    metrics/client-proxy:
      receivers:
        - nginx/client-proxy
      processors: [attributes/client-proxy, batch]
      exporters:
        - prometheusremotewrite/grafana_cloud_metrics
    metrics/session-proxy:
      receivers:
        - nginx/session-proxy
      processors: [attributes/session-proxy, batch]
      exporters:
        - prometheusremotewrite/grafana_cloud_metrics
    metrics:
      receivers:
        - prometheus
        - hostmetrics
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
