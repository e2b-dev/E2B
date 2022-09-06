variable "gcp_zone" {
  type = string
}

variable "lightstep_api_key" {
  type = string
}

variables {
  otel_image = "otel/opentelemetry-collector-contrib:0.59.0"
}

job "otel-collector" {
  datacenters = [var.gcp_zone]
  type        = "service"

  priority = 95

  group "collector" {
    count = 1

    network {
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
        ]
      }

      resources {
        cpu    = 500
        memory = 512
      }

      template {
        data = <<EOF
receivers:
  nginx/client-proxy:
    endpoint: 'http://localhost:3001/status'
    collection_interval: 10s
  nginx/session-proxy:
    endpoint: 'http://localhost:3004/status'
    collection_interval: 10s
  hostmetrics:
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
        - job_name: nomad
          scrape_interval: 10s
          scrape_timeout: 5s
          metrics_path: '/v1/metrics'
          params:
            format: ['prometheus']
          static_configs:
            - targets: ['localhost:4646']
        - job_name: consul
          scrape_interval: 10s
          scrape_timeout: 5s
          metrics_path: '/v1/agent/metrics'
          params:
            format: ['prometheus']
          static_configs:
            - targets: ['localhost:8500']

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

exporters:
  # logging:
  #   loglevel: debug
  otlp/lightstep:
    endpoint: ingest.lightstep.com:443
    headers:
      "lightstep-access-token": ${var.lightstep_api_key}

service:
  # telemetry:
  #   logs:
  #     level: debug
  pipelines:
    metrics/client-proxy:
      receivers:
        - nginx/client-proxy
      processors: [attributes/client-proxy]
      exporters:
        - otlp/lightstep
    metrics/session-proxy:
      receivers:
        - nginx/session-proxy
      processors: [attributes/session-proxy]
      exporters:
        - otlp/lightstep
    metrics:
      receivers: 
        - prometheus
        - hostmetrics
      exporters:
        - otlp/lightstep
      #   - logging
EOF

        destination = "local/config/otel-collector-config.yaml"
      }
    }
  }
}
